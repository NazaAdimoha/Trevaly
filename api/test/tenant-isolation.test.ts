import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { getEnv } from '../src/config/env';
import { PrismaService } from '../src/database/prisma.service';
import { CrossTenantAccessError, tenantDb } from '../src/database/tenant-db';

/**
 * Ported from web's `tenant-isolation.test.ts`, assertion for assertion — the
 * M1 exit criterion, and the Phase 1 gate: the Nest `tenantDb` must refuse
 * exactly what web's refuses.
 *
 * Runs against a real database because the thing under test is query
 * construction, which a mock would happily get wrong in the same way the code
 * does. Two tenants exist for the whole suite — a single-tenant fixture cannot
 * prove isolation, since every query looks correct when there is nothing to leak.
 */

const prisma = new PrismaService(getEnv());

const suffix = randomUUID().slice(0, 8);
const A = `iso-a-${suffix}`;
const B = `iso-b-${suffix}`;

let tenantA: string;
let tenantB: string;
let productA: string;
let productB: string;

beforeAll(async () => {
  const a = await prisma.tenant.create({ data: { name: 'Tenant A', slug: A } });
  const b = await prisma.tenant.create({ data: { name: 'Tenant B', slug: B } });
  tenantA = a.id;
  tenantB = b.id;

  const [pa, pb] = await Promise.all([
    prisma.product.create({
      data: { tenantId: tenantA, name: 'A Widget', slug: 'widget', priceKobo: 100_000, stock: 5 },
    }),
    prisma.product.create({
      data: { tenantId: tenantB, name: 'B Widget', slug: 'widget', priceKobo: 200_000, stock: 5 },
    }),
  ]);
  productA = pa.id;
  productB = pb.id;

  await Promise.all([
    prisma.coupon.create({
      data: { tenantId: tenantA, code: 'SHARED', type: 'PERCENTAGE', value: 10 },
    }),
    prisma.coupon.create({
      data: { tenantId: tenantB, code: 'SHARED', type: 'FIXED', value: 5_000 },
    }),
  ]);
});

afterAll(async () => {
  // Cascade removes products, coupons and orders with the tenant.
  await prisma.tenant.deleteMany({ where: { slug: { in: [A, B] } } });
  await prisma.$disconnect();
});

describe('tenantDb — list reads', () => {
  it('returns only the scoped tenant rows from findMany', async () => {
    const rows = await tenantDb(prisma, tenantA).product.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe(productA);
  });

  it('cannot reach the other tenant even when filtering by its id directly', async () => {
    const rows = await tenantDb(prisma, tenantA).product.findMany({ where: { id: productB } });
    expect(rows).toHaveLength(0);
  });

  it('scopes findFirst', async () => {
    const found = await tenantDb(prisma, tenantA).product.findFirst({ where: { id: productB } });
    expect(found).toBeNull();
  });

  it('scopes count', async () => {
    expect(await tenantDb(prisma, tenantA).product.count()).toBe(1);
  });

  it('scopes a shared coupon code to the right tenant', async () => {
    const a = await tenantDb(prisma, tenantA).coupon.findFirst({ where: { code: 'SHARED' } });
    const b = await tenantDb(prisma, tenantB).coupon.findFirst({ where: { code: 'SHARED' } });

    expect(a?.type).toBe('PERCENTAGE');
    expect(b?.type).toBe('FIXED');
    expect(a?.id).not.toBe(b?.id);
  });
});

describe('tenantDb — unique-target operations', () => {
  // These take a unique `where`, so tenantId cannot be merged in without
  // breaking Prisma's type contract. They go through an ownership pre-check
  // instead — the case a naive wrapper silently lets through.
  it('refuses findUnique against another tenant', async () => {
    await expect(
      tenantDb(prisma, tenantA).product.findUnique({ where: { id: productB } }),
    ).rejects.toBeInstanceOf(CrossTenantAccessError);
  });

  it('refuses update against another tenant', async () => {
    await expect(
      tenantDb(prisma, tenantA).product.update({
        where: { id: productB },
        data: { priceKobo: 1 },
      }),
    ).rejects.toBeInstanceOf(CrossTenantAccessError);

    const untouched = await prisma.product.findUnique({ where: { id: productB } });
    expect(untouched?.priceKobo).toBe(200_000);
  });

  it('refuses delete against another tenant', async () => {
    await expect(
      tenantDb(prisma, tenantA).product.delete({ where: { id: productB } }),
    ).rejects.toBeInstanceOf(CrossTenantAccessError);

    expect(await prisma.product.findUnique({ where: { id: productB } })).not.toBeNull();
  });

  it('allows the same operations on its own rows', async () => {
    const updated = await tenantDb(prisma, tenantA).product.update({
      where: { id: productA },
      data: { stock: 7 },
    });
    expect(updated.stock).toBe(7);
  });
});

describe('tenantDb — writes', () => {
  it('stamps tenantId on create without being told', async () => {
    const created = await tenantDb(prisma, tenantA).deliveryZone.create({
      data: { name: 'Zone A', feeKobo: 150_000 } as never,
    });
    expect(created.tenantId).toBe(tenantA);
  });

  it('ignores a forged tenantId in create data', async () => {
    const created = await tenantDb(prisma, tenantA).deliveryZone.create({
      data: { name: 'Forged', feeKobo: 1, tenantId: tenantB } as never,
    });
    // The wrapper's tenantId is applied last and wins.
    expect(created.tenantId).toBe(tenantA);
  });

  it('scopes deleteMany so it cannot clear another tenant', async () => {
    const { count } = await tenantDb(prisma, tenantA).product.deleteMany({
      where: { id: productB },
    });
    expect(count).toBe(0);
    expect(await prisma.product.findUnique({ where: { id: productB } })).not.toBeNull();
  });
});
