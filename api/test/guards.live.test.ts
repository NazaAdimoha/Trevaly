import { randomUUID } from 'node:crypto';

import { createClerkClient } from '@clerk/express';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { getEnv } from '../src/config/env';
import { PrismaService } from '../src/database/prisma.service';

import { createTestApp } from './support/app';

/**
 * The guards against REAL Clerk sessions, reproducing web's `authorizeStore`
 * and `authorizePlatform` outcomes.
 *
 * Opt-in (`CLERK_LIVE_TESTS=1`): it needs a Clerk development instance, one
 * store member and one SUPER_ADMIN in the database, and it creates real
 * sessions — revoked in `afterAll`, including when a test fails.
 */
const live = process.env.CLERK_LIVE_TESTS === '1';

describe.skipIf(!live)('guards with real Clerk sessions', () => {
  const env = getEnv();
  const clerk = createClerkClient({ secretKey: env.CLERK_SECRET_KEY });
  const prisma = new PrismaService(env);
  const strangerSlug = `guard-${randomUUID().slice(0, 8)}`;
  const sessionIds: string[] = [];

  let app: NestExpressApplication;
  let memberToken: string;
  let memberStore: string;
  let adminToken: string;

  async function tokenFor(userId: string): Promise<string> {
    const session = await clerk.sessions.createSession({ userId });
    sessionIds.push(session.id);
    return (await clerk.sessions.getToken(session.id)).jwt;
  }

  beforeAll(async () => {
    const admin = await prisma.platformUser.findFirst({ where: { role: 'SUPER_ADMIN' } });
    const adminIds = (await prisma.platformUser.findMany()).map((p) => p.clerkUserId);
    const member = await prisma.tenantUser.findFirst({
      where: { clerkUserId: { notIn: adminIds } },
      include: { tenant: true },
    });
    if (!admin || !member) {
      throw new Error('Needs one store member who is not platform staff, and one SUPER_ADMIN');
    }

    // A store the member does not belong to.
    await prisma.tenant.create({ data: { name: 'Guard stranger', slug: strangerSlug } });

    memberStore = member.tenant.slug;
    memberToken = await tokenFor(member.clerkUserId);
    adminToken = await tokenFor(admin.clerkUserId);

    app = await createTestApp();
  });

  afterAll(async () => {
    await Promise.allSettled(sessionIds.map((id) => clerk.sessions.revokeSession(id)));
    await prisma.tenant.deleteMany({ where: { slug: strangerSlug } });
    await prisma.$disconnect();
    await app?.close();
  });

  const get = (path: string, token: string) =>
    request(app.getHttpServer()).get(path).set('authorization', `Bearer ${token}`);

  it('a member reaches their own store with their role', async () => {
    const res = await get(`/api/_probe/stores/${memberStore}`, memberToken).expect(200);
    expect(res.body).toMatchObject({ slug: memberStore, role: expect.any(String) });
  });

  it('a member gets 404 for a store they do not belong to', async () => {
    const res = await get(`/api/_probe/stores/${strangerSlug}`, memberToken).expect(404);
    expect(res.body).toEqual({ error: 'Store not found' });
  });

  it('answers a missing store exactly like a forbidden one — no existence oracle', async () => {
    const forbidden = await get(`/api/_probe/stores/${strangerSlug}`, memberToken);
    const missing = await get(`/api/_probe/stores/no-such-store-${randomUUID()}`, memberToken);
    expect([missing.status, missing.body]).toEqual([forbidden.status, forbidden.body]);
  });

  it('a member is not platform staff', async () => {
    const res = await get('/api/_probe/platform', memberToken).expect(403);
    expect(res.body).toEqual({ error: 'Forbidden' });
  });

  it('platform staff act as OWNER on any existing store', async () => {
    const res = await get(`/api/_probe/stores/${strangerSlug}`, adminToken).expect(200);
    expect(res.body).toMatchObject({ slug: strangerSlug, role: 'OWNER' });
  });

  it('platform staff still get 404 for a store that does not exist', async () => {
    const res = await get(`/api/_probe/stores/no-such-store-${randomUUID()}`, adminToken);
    expect(res.status).toBe(404);
  });

  it('SUPER_ADMIN reaches platform routes', async () => {
    await get('/api/_probe/platform', adminToken).expect(200);
  });

  it('a revoked session is signed out', async () => {
    const userId = (await get('/api/_probe/me', memberToken).expect(200)).body.userId as string;
    const token = await tokenFor(userId);
    await get('/api/_probe/me', token).expect(200);

    await clerk.sessions.revokeSession(sessionIds.at(-1)!);
    // A session JWT stays cryptographically valid until it expires (≤60s) —
    // Clerk's documented networkless model, identical on web. What revocation
    // guarantees is that no NEW token can be minted.
    await expect(clerk.sessions.getToken(sessionIds.at(-1)!)).rejects.toBeTruthy();
  });
});
