import { createHmac, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { createClerkClient } from '@clerk/express';
import { parse as parseEnv } from 'dotenv';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { getEnv } from '../src/config/env';
import { PrismaService } from '../src/database/prisma.service';

import { type Reply, send } from './support/http';

/**
 * CONTRACT PARITY — the running Next app against the running Nest API.
 *
 * The definition of "nothing broke" for the migration (plan Part 6.1): the
 * same request, with the same real Clerk session, against the same database,
 * must produce the same status, the same body and the same headers that
 * clients read. Reads are compared exactly. Writes run once per side with
 * side-marked payloads, and are compared after replacing generated ids,
 * timestamps and the side marker.
 *
 * Passed 30/30 on 2026-09-15, immediately before web's own routes were
 * deleted. The web side must therefore be the pre-migration app: check out
 * `a6281cc` for `custom_ecommerce_build/` (API from HEAD), then run
 * (`PARITY=1`), with both servers sharing CRON_SECRET:
 *   web: CRON_SECRET=… pnpm dev          (port 3000)
 *   api: CRON_SECRET=… pnpm start        (port 4000)
 *
 * Everything is created in three disposable stores and deleted afterwards,
 * along with the Clerk sessions. The authorized path of the order-expiry job is
 * deliberately not called: it cancels stale PENDING orders across EVERY store
 * in the database, including real development data.
 */

const live = process.env.PARITY === '1';
const NEXT = 3000;
const NEST = 4000;

const CUID = /^c[a-z0-9]{20,32}$/;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

/** Replace what legitimately differs between two sides' writes. */
function normalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, normalize(v)]),
    );
  }
  if (typeof value === 'string') {
    if (CUID.test(value)) return '<id>';
    if (ISO.test(value)) return '<date>';
    return value
      .replace(/ord_[a-z0-9-]+_[0-9a-f-]{36}/g, '<reference>')
      .replace(/zq[ab]/g, 'zq_')
      .replace(/ZQ[AB]/g, 'ZQ_');
  }
  return value;
}

/** Two replies from a pair of side-specific requests: same status and body. */
function expectPair(replies: Reply[], { normalized = false, text = false } = {}) {
  const [next, nest] = replies as [Reply, Reply];
  expect(nest.status, `status (next body: ${next.text.slice(0, 200)})`).toBe(next.status);
  if (text) {
    expect(nest.text).toBe(next.text);
  } else if (normalized) {
    expect(normalize(nest.json)).toEqual(normalize(next.json));
  } else {
    expect(nest.json).toEqual(next.json);
  }
}

function headerValue(reply: Reply, name: string): string | undefined {
  const value = reply.headers[name];
  return Array.isArray(value) ? value.join(', ') : value;
}

describe.skipIf(!live)('contract parity: Next (3000) vs Nest (4000)', () => {
  const env = getEnv();
  const prisma = new PrismaService(env);
  const clerk = createClerkClient({ secretKey: env.CLERK_SECRET_KEY });

  const sfx = randomUUID().slice(0, 6);
  const FX = `parity-${sfx}`;
  const OTHER = `parity-other-${sfx}`;
  const SUSP = `parity-susp-${sfx}`;

  const sessions: Record<'merchant' | 'admin', { id: string; token: string; at: number }> =
    {} as never;
  const webhookEventIds: string[] = [];
  const ids = {} as Record<string, string>;

  async function bearer(role: 'merchant' | 'admin'): Promise<Record<string, string>> {
    const s = sessions[role];
    // Session tokens live 60s; refresh well before that.
    if (Date.now() - s.at > 40_000) {
      s.token = (await clerk.sessions.getToken(s.id)).jwt;
      s.at = Date.now();
    }
    return { authorization: `Bearer ${s.token}` };
  }

  type Spec = {
    method?: string;
    path: string;
    nestPath?: string;
    as?: 'merchant' | 'admin';
    body?: unknown;
    rawBody?: string;
    headers?: Record<string, string>;
    /** Storefront calls: Next is reached through this store's hostname. */
    store?: string;
  };

  async function call(side: 'next' | 'nest', spec: Spec): Promise<Reply> {
    const auth = spec.as ? await bearer(spec.as) : {};
    return send({
      port: side === 'next' ? NEXT : NEST,
      method: spec.method ?? 'GET',
      path: side === 'nest' ? (spec.nestPath ?? spec.path) : spec.path,
      host: side === 'next' && spec.store ? `${spec.store}.localhost` : 'localhost',
      headers: { ...auth, ...spec.headers },
      body: spec.body,
      rawBody: spec.rawBody,
    });
  }

  /** The same request to both; asserts identical status and body. */
  async function same(spec: Spec, opts: { normalized?: boolean; headers?: string[] } = {}) {
    const next = await call('next', spec);
    const nest = await call('nest', spec);
    const label = `${spec.method ?? 'GET'} ${spec.path}`;

    expect(nest.status, `${label} status`).toBe(next.status);
    if (next.json === undefined) {
      expect(nest.text, `${label} body`).toBe(next.text);
    } else if (opts.normalized) {
      expect(normalize(nest.json), `${label} body`).toEqual(normalize(next.json));
    } else {
      expect(nest.json, `${label} body`).toEqual(next.json);
    }
    for (const name of opts.headers ?? []) {
      expect(headerValue(nest, name), `${label} ${name}`).toBe(headerValue(next, name));
    }
    return { next, nest };
  }

  /** A write whose payload is marked per side; compared after normalizing. */
  async function sameWrite(
    make: (marker: 'zqa' | 'zqb') => Spec,
  ): Promise<{ next: Reply; nest: Reply }> {
    const nextSpec = make('zqa');
    const nestSpec = make('zqb');
    const next = await call('next', nextSpec);
    const nest = await call('nest', nestSpec);
    const label = `${nextSpec.method ?? 'GET'} ${nextSpec.path}`;
    expect(nest.status, `${label} status`).toBe(next.status);
    expect(normalize(nest.json ?? nest.text), `${label} body`).toEqual(
      normalize(next.json ?? next.text),
    );
    return { next, nest };
  }

  const store = (slug: string, rest = '') => `/api/stores/${slug}${rest}`;

  beforeAll(async () => {
    // Webhook signatures only match if both servers hold the same secret.
    const webEnv = parseEnv(readFileSync('../custom_ecommerce_build/.env'));
    if (webEnv.PAYSTACK_SECRET_KEY !== env.PAYSTACK_SECRET_KEY) {
      throw new Error('web and api .env must hold the same PAYSTACK_SECRET_KEY');
    }

    for (const [port, path] of [
      [NEXT, '/api/app/config'],
      [NEST, '/api/health'],
    ] as const) {
      // A few tries: a pool that sat idle reconnects on its first query.
      let status = 0;
      for (let attempt = 0; attempt < 10 && status !== 200; attempt++) {
        status = (await send({ port, method: 'GET', path }).catch(() => ({ status: 0 }))).status;
        if (status !== 200) await new Promise((r) => setTimeout(r, 2_000));
      }
      if (status !== 200) throw new Error(`server on ${port} is not up (${status})`);
    }

    const admin = await prisma.platformUser.findFirstOrThrow({ where: { role: 'SUPER_ADMIN' } });
    const adminIds = (await prisma.platformUser.findMany()).map((p) => p.clerkUserId);
    const member = await prisma.tenantUser.findFirstOrThrow({
      where: { clerkUserId: { notIn: adminIds } },
    });
    const source = await prisma.tenant.findUniqueOrThrow({
      where: { slug: 'adaobi-store' },
      select: { paystackSubaccountCode: true },
    });

    for (const [role, userId] of [
      ['merchant', member.clerkUserId],
      ['admin', admin.clerkUserId],
    ] as const) {
      const session = await clerk.sessions.createSession({ userId });
      sessions[role] = {
        id: session.id,
        token: (await clerk.sessions.getToken(session.id)).jwt,
        at: Date.now(),
      };
    }

    // ── The store under test, which the merchant owns ─────────────────────
    const fx = await prisma.tenant.create({
      data: {
        name: `Parity ${sfx}`,
        slug: FX,
        status: 'ACTIVE',
        paystackSubaccountCode: source.paystackSubaccountCode,
        platformFeePercent: 2,
        contactEmail: 'parity@example.test',
        tagline: 'Parity fixture',
        orderSequence: 6,
      },
    });
    ids.fx = fx.id;
    await prisma.tenantUser.create({
      data: {
        tenantId: fx.id,
        clerkUserId: member.clerkUserId,
        email: `parity+${sfx}@example.test`,
        role: 'OWNER',
      },
    });

    const [dresses, bags] = await Promise.all([
      prisma.category.create({ data: { tenantId: fx.id, name: 'Dresses', slug: 'dresses', position: 0 } }),
      prisma.category.create({ data: { tenantId: fx.id, name: 'Bags', slug: 'bags', position: 1 } }),
      prisma.category.create({
        data: { tenantId: fx.id, name: 'Hidden', slug: 'hidden', position: 2, isActive: false },
      }),
    ]);
    ids.dresses = dresses.id;
    ids.bags = bags.id;

    const simple = await prisma.product.create({
      data: {
        tenantId: fx.id,
        categoryId: dresses.id,
        name: 'Simple Tee',
        slug: 'simple-tee',
        sku: 'TEE-1',
        priceKobo: 500_000,
        stock: 10,
        imageUrls: [`tenants/${FX}/products/tee`],
      },
    });
    ids.simple = simple.id;
    const shoe = await prisma.product.create({
      data: {
        tenantId: fx.id,
        categoryId: bags.id,
        name: 'Sized Shoe',
        slug: 'sized-shoe',
        priceKobo: 800_000,
        stock: 0,
        optionName: 'Size',
        variants: {
          create: [
            { tenantId: fx.id, value: 'S', stock: 2, position: 0 },
            { tenantId: fx.id, value: 'M', stock: 0, priceKobo: 900_000, position: 1 },
          ],
        },
      },
      include: { variants: true },
    });
    ids.shoe = shoe.id;
    ids.shoeS = shoe.variants.find((v) => v.value === 'S')!.id;
    const lastOne = await prisma.product.create({
      data: { tenantId: fx.id, name: 'Last One', slug: 'last-one', priceKobo: 200_000, stock: 1 },
    });
    ids.lastOne = lastOne.id;
    await prisma.product.create({
      data: {
        tenantId: fx.id,
        name: 'Retired Hat',
        slug: 'retired-hat',
        priceKobo: 100_000,
        stock: 3,
        isActive: false,
      },
    });

    const [mainland, island] = await Promise.all([
      prisma.deliveryZone.create({ data: { tenantId: fx.id, name: 'Mainland', feeKobo: 150_000 } }),
      prisma.deliveryZone.create({
        data: { tenantId: fx.id, name: 'Island', feeKobo: 250_000, position: 1, isActive: false },
      }),
    ]);
    ids.mainland = mainland.id;
    ids.island = island.id;

    const used = await prisma.coupon.create({
      data: { tenantId: fx.id, code: 'USED100', type: 'FIXED', value: 100 },
    });
    ids.usedCoupon = used.id;
    await Promise.all([
      prisma.coupon.create({ data: { tenantId: fx.id, code: 'WELCOME10', type: 'PERCENTAGE', value: 10 } }),
      prisma.coupon.create({
        data: {
          tenantId: fx.id,
          code: 'EXPIRED',
          type: 'FIXED',
          value: 500,
          expiresAt: new Date(Date.now() - 86_400_000),
        },
      }),
      prisma.coupon.create({
        data: { tenantId: fx.id, code: 'MIN50K', type: 'PERCENTAGE', value: 5, minOrderKobo: 5_000_000 },
      }),
    ]);

    const orderBase = {
      tenantId: fx.id,
      customerName: 'Ada Parity',
      customerEmail: 'ada.parity@example.test',
      customerPhone: '08031234567',
      deliveryMethod: 'PICKUP' as const,
      subtotalKobo: 500_000,
      totalKobo: 500_000,
    };
    const orderSpecs = [
      { key: 'pending1', n: 1, status: 'PENDING' as const, couponId: used.id },
      { key: 'pendingA', n: 2, status: 'PENDING' as const },
      { key: 'pendingB', n: 3, status: 'PENDING' as const },
      { key: 'paidA', n: 4, status: 'PAID' as const },
      { key: 'paidB', n: 5, status: 'PAID' as const },
      { key: 'stockIssue', n: 6, status: 'PAID' as const, hasStockIssue: true },
    ];
    for (const spec of orderSpecs) {
      const order = await prisma.order.create({
        data: {
          ...orderBase,
          orderNumber: spec.n,
          status: spec.status,
          couponId: spec.couponId ?? null,
          hasStockIssue: spec.hasStockIssue ?? false,
          paymentReference: `ord_${FX}_${randomUUID()}`,
          paymentVerifiedAt: spec.status === 'PAID' ? new Date() : null,
          items: {
            create: [
              {
                productId: simple.id,
                quantity: 1,
                productName: 'Simple Tee',
                unitPriceKobo: 500_000,
              },
            ],
          },
        },
      });
      ids[spec.key] = order.id;
      ids[`${spec.key}Ref`] = order.paymentReference;
    }

    // ── A store the merchant does NOT belong to ───────────────────────────
    const other = await prisma.tenant.create({
      data: {
        name: `Other ${sfx}`,
        slug: OTHER,
        status: 'ACTIVE',
        customDomain: `${OTHER}.example.test`,
        customDomainVerified: true,
      },
    });
    ids.other = other.id;
    const [otherCategory, otherProduct, otherCoupon, otherZone] = await Promise.all([
      prisma.category.create({ data: { tenantId: other.id, name: 'Other', slug: 'other' } }),
      prisma.product.create({
        data: { tenantId: other.id, name: 'Other Thing', slug: 'other-thing', priceKobo: 1000, stock: 1 },
      }),
      prisma.coupon.create({ data: { tenantId: other.id, code: 'OTHER', type: 'FIXED', value: 100 } }),
      prisma.deliveryZone.create({ data: { tenantId: other.id, name: 'Elsewhere', feeKobo: 100 } }),
    ]);
    Object.assign(ids, {
      otherCategory: otherCategory.id,
      otherProduct: otherProduct.id,
      otherCoupon: otherCoupon.id,
      otherZone: otherZone.id,
    });
    const otherOrder = await prisma.order.create({
      data: {
        ...orderBase,
        tenantId: other.id,
        orderNumber: 1,
        paymentReference: `ord_${OTHER}_${randomUUID()}`,
      },
    });
    ids.otherOrder = otherOrder.id;

    await prisma.tenant.create({
      data: {
        name: `Suspended ${sfx}`,
        slug: SUSP,
        status: 'SUSPENDED',
        paystackSubaccountCode: source.paystackSubaccountCode,
      },
    });
  }, 180_000);

  afterAll(async () => {
    await Promise.allSettled(
      Object.values(sessions).map((s) => clerk.sessions.revokeSession(s.id)),
    );
    const tenants = await prisma.tenant.findMany({
      where: { slug: { in: [FX, OTHER, SUSP] } },
      select: { id: true },
    });
    const tenantIds = tenants.map((t) => t.id);
    // Orders first: OrderItem → Product is RESTRICT, so a tenant cascade that
    // reaches products before order items would fail.
    await prisma.order.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.tenant.deleteMany({ where: { id: { in: tenantIds } } });
    await prisma.webhookEvent.deleteMany({
      where: {
        OR: [
          { providerEventId: { in: webhookEventIds } },
          { reference: { startsWith: `ord_${FX}_` } },
        ],
      },
    });
    await prisma.$disconnect();
  }, 120_000);

  // ────────────────────────────────────────────────────────────────────────
  describe('sessions and access', () => {
    it.each([
      store('adaobi-store', '/orders'),
      '/api/me/stores',
      '/api/platform/tenants',
    ])('no session: %s', async (path) => {
      await same({ path });
    });

    it('forged bearer token', async () => {
      await same({
        path: '/api/me/stores',
        headers: { authorization: 'Bearer eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ1c2VyXzEifQ.c2ln' },
      });
    });

    it('my stores, as merchant and as admin', async () => {
      await same({ path: '/api/me/stores', as: 'merchant' });
      await same({ path: '/api/me/stores', as: 'admin' });
    });

    it('member of another store → 404; missing store → 404', async () => {
      await same({ path: store(OTHER, '/categories'), as: 'merchant' });
      await same({ path: store(`missing-${sfx}`, '/categories'), as: 'merchant' });
    });

    it('platform staff act as owner on any store', async () => {
      await same({ path: store(FX, '/categories'), as: 'admin' });
      await same({ path: store(OTHER, '/settings'), as: 'admin' });
    });

    it('merchant is not platform staff', async () => {
      await same({ path: '/api/platform/tenants', as: 'merchant' });
      await same({ path: '/api/platform/banks', as: 'merchant' });
    });
  });

  describe('store reads', () => {
    it('overview, every period', async () => {
      await same({ path: store(FX, '/overview'), as: 'merchant' }, { normalized: true });
      for (const q of ['period=week', 'period=month', 'period=all', 'period=bogus']) {
        await same({ path: store(FX, `/overview?${q}`), as: 'merchant' }, { normalized: true });
      }
      await same({
        path: store(FX, '/overview?period=custom&from=2026-01-01&to=2026-12-31'),
        as: 'merchant',
      });
      await same({ path: store('adaobi-store', '/overview?period=all'), as: 'admin' });
    });

    it('settings, categories, coupons, delivery zones, upload config', async () => {
      for (const rest of ['/settings', '/categories', '/coupons', '/delivery-zones', '/uploads/signature']) {
        await same({ path: store(FX, rest), as: 'merchant' });
      }
    });

    it('products: list, filters, paging, validation', async () => {
      for (const q of [
        '',
        '?search=tee',
        '?search=TEE-1',
        '?isActive=false',
        `?categoryId=${ids.bags}`,
        '?page=2&pageSize=2',
        '?pageSize=1000',
        '?isActive=maybe',
      ]) {
        await same({ path: store(FX, `/products${q}`), as: 'merchant' });
      }
      await same({ path: store('adaobi-store', '/products'), as: 'admin' });
    });

    it('product detail: own, other store’s, missing', async () => {
      await same({ path: store(FX, `/products/${ids.shoe}`), as: 'merchant' });
      await same({ path: store(FX, `/products/${ids.otherProduct}`), as: 'merchant' });
      await same({ path: store(FX, '/products/cnotarealproductid00000'), as: 'merchant' });
    });

    it('orders: list, filters, search, validation, detail', async () => {
      for (const q of [
        '',
        '?status=PENDING',
        '?status=PAID&pageSize=2&page=1',
        '?needsAttention=true',
        '?search=ada',
        '?search=4',
        '?status=NOPE',
      ]) {
        await same({ path: store(FX, `/orders${q}`), as: 'merchant' });
      }
      // Known web bug, fixed in Nest: a phone number overflowed the order-number
      // lookup and failed the whole search.
      const phone = { path: store(FX, '/orders?search=08031234567'), as: 'merchant' as const };
      const [webPhone, nestPhone] = [await call('next', phone), await call('nest', phone)];
      expect(webPhone.status).toBe(500);
      expect(nestPhone.status).toBe(200);
      expect((nestPhone.json as { total: number }).total).toBe(6);

      await same({ path: store(FX, `/orders/${ids.pending1}`), as: 'merchant' });
      await same({ path: store(FX, `/orders/${ids.otherOrder}`), as: 'merchant' });
      await same({ path: store('adaobi-store', '/orders?pageSize=50'), as: 'admin' });
    });
  });

  describe('categories', () => {
    it('create, conflict, update, delete — and other stores refused', async () => {
      await same({ method: 'POST', path: store(FX, '/categories'), as: 'merchant', body: { name: '' } });
      await same({
        method: 'POST',
        path: store(FX, '/categories'),
        as: 'merchant',
        body: { name: 'Dresses', slug: 'dresses' },
      });

      const created = await sameWrite((m) => ({
        method: 'POST',
        path: store(FX, '/categories'),
        as: 'merchant',
        body: { name: `Hats ${m}`, slug: `hats-${m}`, position: 5 },
      }));
      const nextId = (created.next.json as { id: string }).id;
      const nestId = (created.nest.json as { id: string }).id;

      const renames = await Promise.all([
        call('next', {
          method: 'PATCH',
          path: store(FX, `/categories/${nextId}`),
          as: 'merchant',
          body: { name: 'Caps zqa' },
        }),
        call('nest', {
          method: 'PATCH',
          path: store(FX, `/categories/${nestId}`),
          as: 'merchant',
          body: { name: 'Caps zqb' },
        }),
      ]);
      expectPair(renames, { normalized: true });

      await same({
        method: 'PATCH',
        path: store(FX, `/categories/${nextId}`),
        nestPath: store(FX, `/categories/${nestId}`),
        as: 'merchant',
        body: { slug: 'dresses' },
      });
      await same({
        method: 'PATCH',
        path: store(FX, `/categories/${ids.otherCategory}`),
        as: 'merchant',
        body: { name: 'Mine now' },
      });
      await same({ method: 'DELETE', path: store(FX, `/categories/${ids.otherCategory}`), as: 'merchant' });

      const deleted = await Promise.all([
        call('next', { method: 'DELETE', path: store(FX, `/categories/${nextId}`), as: 'merchant' }),
        call('nest', { method: 'DELETE', path: store(FX, `/categories/${nestId}`), as: 'merchant' }),
      ]);
      expectPair(deleted);
    });
  });

  describe('coupons', () => {
    it('create, conflict, update, delete-when-used, other stores refused', async () => {
      await same({
        method: 'POST',
        path: store(FX, '/coupons'),
        as: 'merchant',
        body: { code: 'x', type: 'PERCENTAGE', value: 500 },
      });
      await same({
        method: 'POST',
        path: store(FX, '/coupons'),
        as: 'merchant',
        body: { code: 'WELCOME10', type: 'PERCENTAGE', value: 10 },
      });

      const created = await sameWrite((m) => ({
        method: 'POST',
        path: store(FX, '/coupons'),
        as: 'merchant',
        body: { code: `SAVE-${m.toUpperCase()}`, type: 'FIXED', value: 50_000, maxUses: 5 },
      }));
      const nextId = (created.next.json as { id: string }).id;
      const nestId = (created.nest.json as { id: string }).id;

      const updates = await Promise.all([
        call('next', {
          method: 'PATCH',
          path: store(FX, `/coupons/${nextId}`),
          as: 'merchant',
          body: { isActive: false, minOrderKobo: 100_000, maxUses: null },
        }),
        call('nest', {
          method: 'PATCH',
          path: store(FX, `/coupons/${nestId}`),
          as: 'merchant',
          body: { isActive: false, minOrderKobo: 100_000, maxUses: null },
        }),
      ]);
      expectPair(updates, { normalized: true });

      await same({
        method: 'PATCH',
        path: store(FX, `/coupons/${nextId}`),
        nestPath: store(FX, `/coupons/${nestId}`),
        as: 'merchant',
        body: { expiresAt: 'not-a-date' },
      });
      await same({
        method: 'PATCH',
        path: store(FX, `/coupons/${ids.otherCoupon}`),
        as: 'merchant',
        body: { isActive: false },
      });
      await same({ method: 'DELETE', path: store(FX, `/coupons/${ids.usedCoupon}`), as: 'merchant' });
      await same({ method: 'DELETE', path: store(FX, `/coupons/${ids.otherCoupon}`), as: 'merchant' });

      const deleted = await Promise.all([
        call('next', { method: 'DELETE', path: store(FX, `/coupons/${nextId}`), as: 'merchant' }),
        call('nest', { method: 'DELETE', path: store(FX, `/coupons/${nestId}`), as: 'merchant' }),
      ]);
      expectPair(deleted);
    });
  });

  describe('delivery zones', () => {
    it('create, update, delete, other stores refused', async () => {
      await same({
        method: 'POST',
        path: store(FX, '/delivery-zones'),
        as: 'merchant',
        body: { name: 'X', feeKobo: -1 },
      });

      const created = await sameWrite((m) => ({
        method: 'POST',
        path: store(FX, '/delivery-zones'),
        as: 'merchant',
        body: { name: `Lekki ${m}`, feeKobo: 0 },
      }));
      const nextId = (created.next.json as { id: string }).id;
      const nestId = (created.nest.json as { id: string }).id;

      await same(
        {
          method: 'PATCH',
          path: store(FX, `/delivery-zones/${nextId}`),
          nestPath: store(FX, `/delivery-zones/${nestId}`),
          as: 'merchant',
          body: { feeKobo: 99_000, isActive: false },
        },
        { normalized: true },
      );
      await same({
        method: 'PATCH',
        path: store(FX, `/delivery-zones/${ids.otherZone}`),
        as: 'merchant',
        body: { feeKobo: 1 },
      });
      await same({ method: 'DELETE', path: store(FX, `/delivery-zones/${ids.otherZone}`), as: 'merchant' });

      const deleted = await Promise.all([
        call('next', { method: 'DELETE', path: store(FX, `/delivery-zones/${nextId}`), as: 'merchant' }),
        call('nest', { method: 'DELETE', path: store(FX, `/delivery-zones/${nestId}`), as: 'merchant' }),
      ]);
      expectPair(deleted);
    });
  });

  describe('products', () => {
    it('refusals: validation, foreign image, foreign category, option rules, conflicts', async () => {
      const base = { name: 'Refused', slug: 'refused', priceKobo: 1000, stock: 1 };
      for (const body of [
        { name: 'x' },
        { ...base, imageUrls: [`tenants/${OTHER}/products/a`] },
        { ...base, categoryId: ids.otherCategory },
        { ...base, optionName: 'Size' },
        { ...base, variants: [{ value: 'S', stock: 1 }] },
        { ...base, optionName: 'Size', variants: [{ value: 'S', stock: 1 }, { value: 's', stock: 1 }] },
        { ...base, slug: 'simple-tee' },
        { ...base, slug: 'refused-sku', sku: 'TEE-1' },
      ]) {
        await same({ method: 'POST', path: store(FX, '/products'), as: 'merchant', body });
      }
    });

    it('create, update variants, delete — and sold or foreign products refused', async () => {
      const created = await sameWrite((m) => ({
        method: 'POST',
        path: store(FX, '/products'),
        as: 'merchant',
        body: {
          name: `Kaftan ${m}`,
          slug: `kaftan-${m}`,
          description: '',
          sku: '',
          priceKobo: 1_200_000,
          stock: 0,
          categoryId: ids.dresses,
          imageUrls: [`tenants/${FX}/products/kaftan`],
          optionName: 'Size',
          variants: [
            { value: 'S', stock: 3 },
            { value: 'M', stock: 1, priceKobo: 1_300_000 },
          ],
        },
      }));
      const nextProduct = created.next.json as { id: string; variants: Array<{ id: string; value: string }> };
      const nestProduct = created.nest.json as { id: string; variants: Array<{ id: string; value: string }> };

      const edit = (product: typeof nextProduct) => ({
        priceKobo: 1_250_000,
        variants: [
          { id: product.variants.find((v) => v.value === 'S')!.id, value: 'S', stock: 9 },
          { value: 'L', stock: 2 },
        ],
      });
      const edits = await Promise.all([
        call('next', {
          method: 'PATCH',
          path: store(FX, `/products/${nextProduct.id}`),
          as: 'merchant',
          body: edit(nextProduct),
        }),
        call('nest', {
          method: 'PATCH',
          path: store(FX, `/products/${nestProduct.id}`),
          as: 'merchant',
          body: edit(nestProduct),
        }),
      ]);
      expectPair(edits, { normalized: true });

      await same({
        method: 'PATCH',
        path: store(FX, `/products/${nextProduct.id}`),
        nestPath: store(FX, `/products/${nestProduct.id}`),
        as: 'merchant',
        body: { optionName: 'Size', variants: [{ id: ids.shoeS, value: 'S', stock: 1 }] },
      });
      await same({
        method: 'PATCH',
        path: store(FX, `/products/${ids.otherProduct}`),
        as: 'merchant',
        body: { priceKobo: 1 },
      });
      await same({ method: 'DELETE', path: store(FX, `/products/${ids.simple}`), as: 'merchant' });
      await same({ method: 'DELETE', path: store(FX, `/products/${ids.otherProduct}`), as: 'merchant' });

      const deleted = await Promise.all([
        call('next', { method: 'DELETE', path: store(FX, `/products/${nextProduct.id}`), as: 'merchant' }),
        call('nest', { method: 'DELETE', path: store(FX, `/products/${nestProduct.id}`), as: 'merchant' }),
      ]);
      expectPair(deleted, { text: true });
    });

    it('CSV import: refusals, preview, commit', async () => {
      await same({ method: 'POST', path: store(FX, '/products/import'), as: 'merchant', body: {} });
      await same({
        method: 'POST',
        path: store(FX, '/products/import'),
        as: 'merchant',
        body: { csv: 'name,price,stock\n' },
      });

      const csv = [
        'name,price,stock,sku,category,description,option,variants,images',
        'Simple Tee,5000,1,,,,,,',
        'Wrap Skirt,"₦12,500",4,,Skirts,Cotton,,,',
        ',100,1,,,,,,',
        'Headband,abc,1,,,,,,',
      ].join('\n');
      await same(
        { method: 'POST', path: store(FX, '/products/import'), as: 'merchant', body: { csv } },
        { normalized: true },
      );

      await sameWrite((m) => ({
        method: 'POST',
        path: store(FX, '/products/import'),
        as: 'merchant',
        body: {
          commit: true,
          csv: [
            'name,price,stock,category,option,variants',
            `Import Tee ${m},4000,5,Imported ${m},,`,
            `Import Gown ${m},20000,,Imported ${m},Size,S=2;M=1@21000`,
          ].join('\n'),
        },
      }));
    });
  });

  describe('orders', () => {
    it('refused transitions, validation, notes, cancellation, other stores', async () => {
      await same({
        method: 'PATCH',
        path: store(FX, `/orders/${ids.pending1}`),
        as: 'merchant',
        body: { status: 'DELIVERED' },
      });
      await same({
        method: 'PATCH',
        path: store(FX, `/orders/${ids.pending1}`),
        as: 'merchant',
        body: { paidAfterCancellation: true },
      });
      await same({
        method: 'PATCH',
        path: store(FX, `/orders/${ids.otherOrder}`),
        as: 'merchant',
        body: { internalNote: 'mine' },
      });
      await same(
        {
          method: 'PATCH',
          path: store(FX, `/orders/${ids.stockIssue}`),
          as: 'merchant',
          body: { internalNote: 'Called the customer', hasStockIssue: false },
        },
        { normalized: true },
      );

      const cancels = await Promise.all([
        call('next', {
          method: 'PATCH',
          path: store(FX, `/orders/${ids.pendingA}`),
          as: 'merchant',
          body: { status: 'CANCELLED' },
        }),
        call('nest', {
          method: 'PATCH',
          path: store(FX, `/orders/${ids.pendingB}`),
          as: 'merchant',
          body: { status: 'CANCELLED' },
        }),
      ]);
      expect(cancels[1].status).toBe(cancels[0].status);
      const strip = (j: unknown) => {
        const { orderNumber: _n, paymentReference: _r, ...rest } = j as Record<string, unknown>;
        return normalize(rest);
      };
      expect(strip(cancels[1].json)).toEqual(strip(cancels[0].json));
    });
  });

  describe('settings and uploads', () => {
    it('settings: validation, foreign logo, update', async () => {
      await same({ method: 'PATCH', path: store(FX, '/settings'), as: 'merchant', body: { name: 'x' } });
      await same({
        method: 'PATCH',
        path: store(FX, '/settings'),
        as: 'merchant',
        body: { logoPublicId: `tenants/${OTHER}/branding/logo` },
      });
      await same({
        method: 'PATCH',
        path: store(FX, '/settings'),
        as: 'merchant',
        body: { tagline: 'Same everywhere', logoPublicId: `tenants/${FX}/branding/logo` },
      });
    });

    it('upload signature: signs, refuses extras and foreign folders', async () => {
      for (const body of [
        { paramsToSign: { folder: `tenants/${FX}/products`, timestamp: 1_789_000_000 } },
        { paramsToSign: { folder: `tenants/${FX}/branding`, timestamp: 1_789_000_000 } },
        { paramsToSign: { folder: `tenants/${FX}/products`, timestamp: 1, eager: 'w_4000' } },
        { paramsToSign: { folder: `tenants/${OTHER}/products`, timestamp: 1 } },
        { paramsToSign: 'nope' },
      ]) {
        await same({ method: 'POST', path: store(FX, '/uploads/signature'), as: 'merchant', body });
      }
    });
  });

  describe('platform', () => {
    it('tenants, banks, webhook events', async () => {
      await same({ path: '/api/platform/tenants', as: 'admin' });
      await same({ path: '/api/platform/banks', as: 'admin' }, { headers: ['cache-control'] });
      for (const q of ['', '?status=FAILED', '?status=PROCESSED&page=2&pageSize=5', '?status=NOPE']) {
        await same({ path: `/api/platform/webhook-events${q}`, as: 'admin' });
      }
    });

    it('onboarding refusals (no Paystack call is reached)', async () => {
      await same({ method: 'POST', path: '/api/platform/tenants', as: 'admin', body: { name: 'x' } });
      await same({
        method: 'POST',
        path: '/api/platform/tenants',
        as: 'admin',
        body: {
          name: 'Taken Store',
          slug: FX,
          ownerEmail: 'owner@example.test',
          bankCode: '058',
          accountNumber: '0123456789',
          platformFeePercent: 1,
        },
      });
      await same({
        method: 'POST',
        path: '/api/platform/tenants',
        as: 'admin',
        body: {
          name: 'Reserved',
          slug: 'admin',
          ownerEmail: 'owner@example.test',
          bankCode: '058',
          accountNumber: '0123456789',
          platformFeePercent: 1,
        },
      });
    });
  });

  describe('storefront: coupon preview and checkout', () => {
    const preview = (body: unknown, slug = FX): Spec => ({
      method: 'POST',
      path: '/api/coupons/preview',
      nestPath: `/api/storefront/${slug}/coupons/preview`,
      store: slug,
      body,
    });
    const checkout = (body: unknown, slug = FX): Spec => ({
      method: 'POST',
      path: '/api/checkout',
      nestPath: `/api/storefront/${slug}/checkout`,
      store: slug,
      body,
    });
    const shopper = {
      customerName: 'Chi Parity',
      // Paystack refuses `.test` addresses at initialization.
      customerEmail: 'chi.parity@example.com',
      customerPhone: '08039876543',
      deliveryMethod: 'PICKUP',
    };

    it('coupon preview: uniform refusals, discount, then the rate limit', async () => {
      await same(preview({ code: '' }));
      await same(preview({ code: 'welcome10', subtotalKobo: 1_000_000 }));
      await same(preview({ code: 'EXPIRED', subtotalKobo: 1_000_000 }));
      await same(preview({ code: 'NOSUCHCODE', subtotalKobo: 1_000_000 }));
      await same(preview({ code: 'MIN50K', subtotalKobo: 1_000_000 }));

      // Ten per minute per shopper per store; the eleventh is refused.
      for (let attempt = 6; attempt <= 11; attempt++) {
        const { next } = await same(preview({ code: 'WELCOME10', subtotalKobo: 100 }));
        expect(next.status).toBe(attempt <= 10 ? 200 : 429);
        if (attempt === 11) expect(headerValue(next, 'retry-after')).toBeTruthy();
      }
    });

    it('checkout: every refusal, then a real order and Paystack initialization', async () => {
      await same(checkout(shopper, SUSP));
      await same(checkout({ ...shopper, items: [{ productId: ids.otherProduct, quantity: 1 }] }, OTHER));
      await same(checkout({ items: [] }));
      await same(checkout({ ...shopper, items: [{ productId: 'cnotarealproduct000000', quantity: 1 }] }));
      await same(checkout({ ...shopper, items: [{ productId: ids.shoe, quantity: 1 }] }));
      await same(
        checkout({ ...shopper, items: [{ productId: ids.simple, variantId: ids.shoeS, quantity: 1 }] }),
      );
      await same(checkout({ ...shopper, items: [{ productId: ids.lastOne, quantity: 2 }] }));
      await same(
        checkout({
          ...shopper,
          deliveryMethod: 'ZONE_DELIVERY',
          deliveryZoneId: ids.island,
          deliveryAddress: '12 Parity Close, Ikeja',
          items: [{ productId: ids.simple, quantity: 1 }],
        }),
      );
      await same(
        checkout({ ...shopper, couponCode: 'EXPIRED', items: [{ productId: ids.simple, quantity: 1 }] }),
      );

      const next = await call(
        'next',
        checkout({
          ...shopper,
          couponCode: 'WELCOME10',
          deliveryMethod: 'ZONE_DELIVERY',
          deliveryZoneId: ids.mainland,
          deliveryAddress: '12 Parity Close, Ikeja',
          items: [
            { productId: ids.simple, quantity: 1 },
            { productId: ids.shoe, variantId: ids.shoeS, quantity: 1 },
          ],
        }),
      );
      const nest = await call(
        'nest',
        checkout({
          ...shopper,
          couponCode: 'WELCOME10',
          deliveryMethod: 'ZONE_DELIVERY',
          deliveryZoneId: ids.mainland,
          deliveryAddress: '12 Parity Close, Ikeja',
          items: [
            { productId: ids.simple, quantity: 1 },
            { productId: ids.shoe, variantId: ids.shoeS, quantity: 1 },
          ],
        }),
      );
      expect(next.status, JSON.stringify(next.json)).toBe(200);
      expect(nest.status, JSON.stringify(nest.json)).toBe(200);
      const shape = (j: unknown) =>
        Object.fromEntries(Object.entries(j as object).map(([k, v]) => [k, typeof v]));
      expect(shape(nest.json)).toEqual(shape(next.json));

      // The two orders must be identical in everything but identity.
      const orders = await prisma.order.findMany({
        where: {
          paymentReference: {
            in: [
              (next.json as { reference: string }).reference,
              (nest.json as { reference: string }).reference,
            ],
          },
        },
        include: { items: { orderBy: { productName: 'asc' } } },
      });
      expect(orders).toHaveLength(2);
      const comparable = orders.map(
        ({ id: _i, orderNumber: _n, paymentReference: _r, createdAt: _c, updatedAt: _u, items, ...o }) => ({
          ...o,
          platformFeePercent: String(o.platformFeePercent),
          items: items.map(({ id: _id, orderId: _oid, ...item }) => item),
        }),
      );
      expect(comparable[1]).toEqual(comparable[0]);
      // subtotal 13,000 + delivery 1,500 − 10% of subtotal 1,300 = 13,200 naira
      expect(orders[0]!.totalKobo).toBe(1_320_000);
    });
  });

  describe('payments', () => {
    it('verify: missing, unknown, not yet confirmable', async () => {
      await same({ method: 'POST', path: '/api/payments/verify', body: {} });
      await same({ method: 'POST', path: '/api/payments/verify', body: { reference: 'ord_nope_1' } });
      await same({ method: 'POST', path: '/api/payments/verify', body: { reference: ids.pending1Ref } });
    });

    const sign = (raw: string) =>
      createHmac('sha512', env.PAYSTACK_SECRET_KEY).update(raw).digest('hex');

    async function webhook(side: 'next' | 'nest', event: object, signature?: string) {
      const raw = JSON.stringify(event);
      return call(side, {
        method: 'POST',
        path: '/api/webhooks/paystack',
        rawBody: raw,
        headers: { 'x-paystack-signature': signature ?? sign(raw) },
      });
    }

    function eventId(): number {
      const id = Date.now() * 1000 + Math.floor(Math.random() * 1000);
      webhookEventIds.push(String(id));
      return id;
    }

    it('webhook: signature, dispute, duplicate, ignored, unknown reference, failed charge', async () => {
      const bad = await Promise.all(
        (['next', 'nest'] as const).map((side) => webhook(side, { event: 'charge.success' }, 'deadbeef')),
      );
      expectPair(bad);

      // Dispute: each side on its own PAID order.
      const disputeFor = (reference: string, id: number) => ({
        event: 'charge.dispute.create',
        data: {
          id,
          status: 'awaiting-merchant-feedback',
          reason: 'Customer says not received',
          refund_amount: 500_000,
          transaction: { reference },
        },
      });
      const nextDispute = disputeFor(ids.paidARef!, eventId());
      const nestDispute = disputeFor(ids.paidBRef!, eventId());
      const disputes = [await webhook('next', nextDispute), await webhook('nest', nestDispute)];
      expectPair(disputes);

      const disputed = await prisma.order.findMany({
        where: { id: { in: [ids.paidA!, ids.paidB!] } },
        select: { disputeStatus: true, disputeReason: true, disputeAmountKobo: true, disputedAt: true },
      });
      expect(disputed[0]!.disputedAt).toBeTruthy();
      expect({ ...disputed[1], disputedAt: 'set' }).toEqual({ ...disputed[0], disputedAt: 'set' });

      // Redelivery of the SAME event to the same side.
      const dupes = [await webhook('next', nextDispute), await webhook('nest', nestDispute)];
      expectPair(dupes);

      const ignored = [
        await webhook('next', { event: 'transfer.success', data: { id: eventId() } }),
        await webhook('nest', { event: 'transfer.success', data: { id: eventId() } }),
      ];
      expectPair(ignored);

      const unknown = [
        await webhook('next', {
          event: 'refund.processed',
          data: { id: eventId(), amount: 100, transaction: { reference: `ord_${FX}_missing-a` } },
        }),
        await webhook('nest', {
          event: 'refund.processed',
          data: { id: eventId(), amount: 100, transaction: { reference: `ord_${FX}_missing-b` } },
        }),
      ];
      expectPair(unknown);

      // A charge.success Paystack does not recognise must FAIL (500, retried).
      const failed = [
        await webhook('next', { event: 'charge.success', data: { id: eventId(), reference: ids.pending1Ref } }),
        await webhook('nest', { event: 'charge.success', data: { id: eventId(), reference: ids.pending1Ref } }),
      ];
      expectPair(failed);

      const rows = await prisma.webhookEvent.findMany({
        where: { providerEventId: { in: webhookEventIds } },
        orderBy: { createdAt: 'asc' },
        select: { eventType: true, status: true, error: true, attempts: true },
      });
      // Written in pairs, next then nest, so each pair must match.
      for (let i = 0; i + 1 < rows.length; i += 2) {
        const [a, b] = [rows[i]!, rows[i + 1]!];
        expect({ ...b, error: b.error?.replace(/zq[ab]|missing-[ab]/g, '') }).toEqual({
          ...a,
          error: a.error?.replace(/zq[ab]|missing-[ab]/g, ''),
        });
      }
    });

    it('scheduled job: refuses without the secret', async () => {
      for (const headers of [{}, { authorization: 'Bearer wrong' }] as Record<string, string>[]) {
        await same({ path: '/api/cron/expire-orders', nestPath: '/api/jobs/expire-orders', headers });
      }
    });
  });

  describe('app config', () => {
    it('matches, header included', async () => {
      await same({ path: '/api/app/config' }, { headers: ['cache-control'] });
    });
  });
});
