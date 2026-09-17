import { randomUUID } from 'node:crypto';

import { createClerkClient } from '@clerk/express';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { defaultLayout, sectionId } from '@core/storefront/layout';

import { getEnv } from '../src/config/env';
import { PrismaService } from '../src/database/prisma.service';

import { createTestApp } from './support/app';

/**
 * The storefront layout endpoints, against a real database and a real Clerk
 * session. The properties that matter:
 *
 *  - a store that has never been edited still answers with a usable layout
 *  - a draft is invisible to shoppers until it is published
 *  - two editors cannot silently overwrite each other
 *  - a layout cannot smuggle in another store's images
 */
const live = process.env.CLERK_LIVE_TESTS === '1';

type LoadedLayout = {
  draft: Record<string, unknown> & {
    preset: string;
    pages: { home: unknown[]; product: unknown[]; collection: unknown[] };
    header: Record<string, unknown>;
  };
  version: number;
};

describe.skipIf(!live)('storefront layout', () => {
  const env = getEnv();
  const prisma = new PrismaService(env);
  const clerk = createClerkClient({ secretKey: env.CLERK_SECRET_KEY });

  const sfx = randomUUID().slice(0, 6);
  const SLUG = `design-${sfx}`;
  const OTHER = `design-other-${sfx}`;

  let app: NestExpressApplication;
  let sessionId: string;
  let token: string;
  let tokenAt = 0;

  async function bearer() {
    if (Date.now() - tokenAt > 40_000) {
      token = (await clerk.sessions.getToken(sessionId)).jwt;
      tokenAt = Date.now();
    }
    return { authorization: `Bearer ${token}` };
  }

  const url = (rest = '') => `/api/stores/${SLUG}/storefront${rest}`;

  // These resolve to the response: supertest's Test is thenable, so a helper
  // cannot hand one back from an async function without it executing.
  const get = async (path: string) =>
    request(app.getHttpServer()).get(path).set(await bearer());
  const put = async (path: string, body: unknown) =>
    request(app.getHttpServer())
      .put(path)
      .set(await bearer())
      .send(body as object);
  const post = async (path: string, body: unknown = {}) =>
    request(app.getHttpServer())
      .post(path)
      .set(await bearer())
      .send(body as object);

  /** Reads better than `expect(res.status).toBe(x)` at every call site. */
  const ok = (res: { status: number; body: unknown }, status = 200) => {
    expect(res.status, JSON.stringify(res.body)).toBe(status);
    return res.body as never;
  };

  beforeAll(async () => {
    const adminIds = (await prisma.platformUser.findMany()).map((p) => p.clerkUserId);
    const member = await prisma.tenantUser.findFirstOrThrow({
      where: { clerkUserId: { notIn: adminIds } },
    });

    const session = await clerk.sessions.createSession({ userId: member.clerkUserId });
    sessionId = session.id;
    token = (await clerk.sessions.getToken(session.id)).jwt;
    tokenAt = Date.now();

    const tenant = await prisma.tenant.create({
      data: { name: `Design ${sfx}`, slug: SLUG, status: 'ACTIVE', theme: 'EDITORIAL' },
    });
    await prisma.tenantUser.create({
      data: {
        tenantId: tenant.id,
        clerkUserId: member.clerkUserId,
        email: `design+${sfx}@example.test`,
        role: 'OWNER',
      },
    });
    await prisma.tenant.create({
      data: { name: `Other ${sfx}`, slug: OTHER, status: 'ACTIVE' },
    });

    app = await createTestApp();
  }, 120_000);

  afterAll(async () => {
    await clerk.sessions.revokeSession(sessionId).catch(() => undefined);
    await prisma.tenant.deleteMany({ where: { slug: { in: [SLUG, OTHER] } } });
    await prisma.$disconnect();
    await app?.close();
  }, 60_000);

  it('seeds a layout on first open, from the theme the store already had', async () => {
    const body = ok(await get(url())) as {
      draft: { preset: string; pages: { home: unknown[] } };
      published: unknown;
      version: number;
    };
    // EDITORIAL maps to the serif preset, so an existing store is recognisable.
    expect(body.draft.preset).toBe('atelier');
    expect(body.draft.pages.home.length).toBeGreaterThan(0);
    expect(body.published).toBeNull();
    expect(body.version).toBe(1);
  });

  it('serves a usable layout to shoppers before anything is published', async () => {
    const res = await request(app.getHttpServer()).get(`/api/storefront/${SLUG}/layout`);
    ok(res);
    expect(res.body.layout.preset).toBe('atelier');
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('keeps a draft away from shoppers until it is published', async () => {
    const loaded = ok(await get(url())) as LoadedLayout;
    const draft = {
      ...loaded.draft,
      preset: 'obsidian',
      pages: {
        ...loaded.draft.pages,
        home: [
          ...loaded.draft.pages.home,
          {
            id: sectionId('rich-text'),
            type: 'rich-text',
            visible: true,
            settings: { heading: 'Drafted, not published', align: 'center' },
          },
        ],
      },
    };

    const saved = ok(await put(url('/draft'), { version: loaded.version, layout: draft })) as {
      version: number;
    };
    expect(saved.version).toBe(loaded.version + 1);

    const shopper = await request(app.getHttpServer()).get(`/api/storefront/${SLUG}/layout`);
    expect(shopper.body.layout.preset).toBe('atelier');
    expect(JSON.stringify(shopper.body.layout)).not.toContain('Drafted, not published');

    const published = ok(await post(url('/publish'), { version: saved.version })) as {
      publishedAt: string;
    };
    expect(published.publishedAt).toBeTruthy();

    const after = await request(app.getHttpServer()).get(`/api/storefront/${SLUG}/layout`);
    expect(after.body.layout.preset).toBe('obsidian');
    expect(JSON.stringify(after.body.layout)).toContain('Drafted, not published');
  });

  it('refuses a stale version instead of overwriting the other editor', async () => {
    const loaded = ok(await get(url())) as LoadedLayout;
    const res = await put(url('/draft'), { version: loaded.version - 1, layout: loaded.draft });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/while you were editing/i);
    expect(res.body.currentVersion).toBe(loaded.version);
  });

  it('refuses another store’s images', async () => {
    const loaded = ok(await get(url())) as LoadedLayout;
    const layout = {
      ...loaded.draft,
      pages: {
        ...loaded.draft.pages,
        home: [
          {
            id: sectionId('collection-row'),
            type: 'collection-row',
            visible: true,
            settings: { heading: 'Mine now' },
          },
        ],
      },
      header: {
        ...loaded.draft.header,
        menu: [
          {
            label: 'Shop',
            href: '/',
            children: [
              { label: 'Stolen', href: '/', image: `tenants/${OTHER}/products/hero` },
            ],
          },
        ],
      },
    };

    const res = await put(url('/draft'), { version: loaded.version, layout });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/do not belong to this store/i);
  });

  it('rejects a section the registry does not know, naming it', async () => {
    const loaded = ok(await get(url())) as LoadedLayout;
    const res = await put(url('/draft'), {
      version: loaded.version,
      layout: {
        ...loaded.draft,
        pages: {
          ...loaded.draft.pages,
          home: [{ id: 'x1', type: 'unicorn', visible: true, settings: {} }],
        },
      },
    });
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body.issues)).toContain('unicorn');
  });

  it('reverts a draft back to what shoppers see', async () => {
    const loaded = ok(await get(url())) as LoadedLayout;
    ok(
      await put(url('/draft'), {
        version: loaded.version,
        layout: { ...loaded.draft, preset: 'playful' },
      }),
    );

    const reverted = ok(await post(url('/revert'))) as { draft: { preset: string } };
    expect(reverted.draft.preset).toBe('obsidian');
  });

  it('is refused for a store the merchant does not belong to', async () => {
    const res = await get(`/api/stores/${OTHER}/storefront`);
    expect(res.status).toBe(404);
  });

  it('never lets a broken stored layout take the storefront down', async () => {
    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { slug: SLUG } });
    await prisma.storefrontLayout.update({
      where: { tenantId: tenant.id },
      data: {
        published: {
          version: 1,
          preset: 'obsidian',
          pages: { home: [{ id: 'a', type: 'from-the-future', visible: true, settings: {} }] },
        },
      },
    });

    const res = await request(app.getHttpServer()).get(`/api/storefront/${SLUG}/layout`);
    ok(res);
    expect(res.body.layout.pages.home).toEqual([]);
    expect(res.body.layout.preset).toBe('obsidian');
  });

  it('the default layout parses as valid input to the API', async () => {
    const loaded = ok(await get(url())) as LoadedLayout;
    const res = await put(url('/draft'), {
      version: loaded.version,
      layout: defaultLayout('momentum'),
    });
    ok(res);
    expect(res.body.draft.preset).toBe('momentum');
  });
});
