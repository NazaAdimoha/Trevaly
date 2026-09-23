import { randomUUID } from 'node:crypto';

import { createClerkClient } from '@clerk/express';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { getEnv } from '../src/config/env';
import { PrismaService } from '../src/database/prisma.service';

import { createTestApp } from './support/app';

/**
 * The product write contract the MOBILE app now depends on.
 *
 * The app used to send a name, a price and a count, and tell the merchant to
 * use the web for anything else. It now sends descriptions, a category and a
 * one-axis option list, and it can delete — so the payload shape it builds has
 * to be pinned somewhere, or a change here breaks a client that ships through
 * an app store rather than a deploy.
 *
 * The delete cases are the ones worth having: a product on a real order must
 * NOT be deletable, because `OrderItem.product` is `Restrict` precisely so that
 * order history cannot rewrite itself.
 */
const live = process.env.CLERK_LIVE_TESTS === '1';

describe.skipIf(!live)('product writes (mobile payload)', () => {
  const env = getEnv();
  const prisma = new PrismaService(env);
  const clerk = createClerkClient({ secretKey: env.CLERK_SECRET_KEY });

  const sfx = randomUUID().slice(0, 6);
  const SLUG = `prod-${sfx}`;

  let app: NestExpressApplication;
  let sessionId: string;
  let token: string;
  let tokenAt = 0;
  let tenantId: string;
  let categoryId: string;

  async function bearer() {
    if (Date.now() - tokenAt > 40_000) {
      token = (await clerk.sessions.getToken(sessionId)).jwt;
      tokenAt = Date.now();
    }
    return { authorization: `Bearer ${token}` };
  }

  const url = (rest = '') => `/api/stores/${SLUG}/products${rest}`;

  const post = async (path: string, body: unknown) =>
    request(app.getHttpServer()).post(path).set(await bearer()).send(body as object);
  const patch = async (path: string, body: unknown) =>
    request(app.getHttpServer()).patch(path).set(await bearer()).send(body as object);
  const del = async (path: string) =>
    request(app.getHttpServer()).delete(path).set(await bearer());
  const get = async (path: string) =>
    request(app.getHttpServer()).get(path).set(await bearer());

  const ok = (res: { status: number; body: unknown }, status = 200) => {
    expect(res.status, JSON.stringify(res.body)).toBe(status);
    return res.body as never;
  };

  /** Exactly what `toPayload()` in the app builds, for a product with options. */
  const withOptions = (name: string) => ({
    name,
    slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    description: 'Hand-cut Ankara, fully lined, cold wash only.',
    // Per product: SKU is unique per tenant, so a shared one here would make
    // every case after the first fail on the constraint rather than on itself.
    sku: `SKU-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    priceKobo: 2_500_000,
    stock: 0, // ignored when options exist — the app sends 0 deliberately
    imageUrls: [],
    categoryId,
    isActive: true,
    optionName: 'Size',
    variants: [
      { value: 'Small', priceKobo: null, stock: 3, isActive: true },
      { value: 'Large', priceKobo: 2_800_000, stock: 1, isActive: true },
    ],
  });

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
      data: { name: `Products ${sfx}`, slug: SLUG, status: 'ACTIVE' },
    });
    tenantId = tenant.id;
    await prisma.tenantUser.create({
      data: {
        tenantId,
        clerkUserId: member.clerkUserId,
        email: `products+${sfx}@example.test`,
        role: 'OWNER',
      },
    });
    const category = await prisma.category.create({
      data: { tenantId, name: 'Dresses', slug: 'dresses' },
    });
    categoryId = category.id;

    app = await createTestApp();
  }, 120_000);

  afterAll(async () => {
    await clerk.sessions.revokeSession(sessionId).catch(() => undefined);
    // Orders first: OrderItem.product is Restrict, so a tenant carrying one
    // cannot cascade away. This is the same rule the test below asserts.
    await prisma.order.deleteMany({ where: { tenantId } });
    await prisma.tenant.deleteMany({ where: { slug: SLUG } });
    await prisma.$disconnect();
    await app?.close();
  }, 60_000);

  it('accepts the description, category and options the app now sends', async () => {
    const created = ok(await post(url(), withOptions(`Ankara ${sfx}`)), 201) as {
      id: string;
    };

    const product = (await get(url(`/${created.id}`))).body;
    expect(product.description).toBe('Hand-cut Ankara, fully lined, cold wash only.');
    expect(product.sku).toMatch(/^SKU-ankara-/);
    expect(product.categoryId).toBe(categoryId);
    expect(product.optionName).toBe('Size');
    expect(product.variants).toHaveLength(2);

    // Blank price inherits; an override is kept as sent.
    const small = product.variants.find((v: { value: string }) => v.value === 'Small');
    const large = product.variants.find((v: { value: string }) => v.value === 'Large');
    expect(small.priceKobo).toBeNull();
    expect(small.stock).toBe(3);
    expect(large.priceKobo).toBe(2_800_000);
  });

  it('edits an existing option by id and drops one left out', async () => {
    const created = ok(await post(url(), withOptions(`Edit ${sfx}`)), 201) as { id: string };
    const before = (await get(url(`/${created.id}`))).body;
    const small = before.variants.find((v: { value: string }) => v.value === 'Small');

    ok(
      await patch(url(`/${created.id}`), {
        optionName: 'Size',
        variants: [{ id: small.id, value: 'Small', priceKobo: null, stock: 9, isActive: true }],
      }),
    );

    const after = (await get(url(`/${created.id}`))).body;
    expect(after.variants).toHaveLength(1);
    expect(after.variants[0].id).toBe(small.id); // updated, not recreated
    expect(after.variants[0].stock).toBe(9);
  });

  it('refuses a half-configured product, in the merchant’s words', async () => {
    const noName = await post(url(), {
      ...withOptions(`Half ${sfx}`),
      optionName: '',
    });
    expect(noName.status).toBe(400);
    expect(noName.body.error).toMatch(/Name what the options are/i);

    const noVariants = await post(url(), {
      ...withOptions(`Half2 ${sfx}`),
      variants: [],
    });
    expect(noVariants.status).toBe(400);
    expect(noVariants.body.error).toMatch(/at least one size/i);
  });

  /**
   * Regression: a duplicate SKU used to be reported as a duplicate SLUG.
   *
   * Prisma 7 with a driver adapter leaves `meta.target` undefined, so the
   * controller's check for "sku" in it always fell through to "slug". A
   * merchant would rename the product, hit the same wall, and have nothing to
   * go on. The app now sends an SKU, which makes this reachable in normal use.
   */
  it('names the SKU, not the slug, when the SKU is the duplicate', async () => {
    const first = withOptions(`Dup ${sfx}`);
    ok(await post(url(), first), 201);

    const clash = await post(url(), {
      ...withOptions(`Dup2 ${sfx}`),
      sku: first.sku,
    });

    expect(clash.status).toBe(409);
    expect(clash.body.error).toBe('A product with this SKU already exists');
  });

  it('deletes a product that has never been ordered', async () => {
    const created = ok(await post(url(), withOptions(`Gone ${sfx}`)), 201) as { id: string };

    expect((await del(url(`/${created.id}`))).status).toBe(204);
    expect((await get(url(`/${created.id}`))).status).toBe(404);
  });

  it('refuses to delete a product that appears on an order, and says to hide it', async () => {
    const created = ok(await post(url(), withOptions(`Sold ${sfx}`)), 201) as { id: string };

    await prisma.order.create({
      data: {
        tenantId,
        orderNumber: 1,
        customerName: 'Buyer',
        customerEmail: 'buyer@example.test',
        customerPhone: '08000000000',
        subtotalKobo: 2_500_000,
        totalKobo: 2_500_000,
        paymentReference: `ref_${randomUUID()}`,
        items: {
          create: [
            {
              productId: created.id,
              quantity: 1,
              productName: 'Sold',
              unitPriceKobo: 2_500_000,
            },
          ],
        },
      },
    });

    const refused = await del(url(`/${created.id}`));
    expect(refused.status).toBe(409);
    // The app shows this verbatim, so the wording is part of the contract.
    expect(refused.body.error).toMatch(/cannot be deleted.*inactive/i);

    // And it is still there, which is the whole point.
    expect((await get(url(`/${created.id}`))).status).toBe(200);
  });
});
