import { randomUUID } from 'node:crypto';

import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { getEnv } from '../src/config/env';
import { PrismaService } from '../src/database/prisma.service';

import { createTestApp } from './support/app';

/**
 * The order confirmation endpoint.
 *
 * The reference in the URL IS the credential — a customer who has just paid has
 * no account — so the field list is a security decision, and this file exists to
 * pin it. The assertions that matter most are the NEGATIVE ones: adding a field
 * to a Prisma `select` is a one-line change that silently starts shipping
 * someone's phone number to anyone holding a forwarded link, and nothing else in
 * the system would notice.
 */
let app: NestExpressApplication;

const prisma = new PrismaService(getEnv());
const SLUG = `ord-${randomUUID().slice(0, 8)}`;
const OTHER = `ord-other-${randomUUID().slice(0, 8)}`;
const REFERENCE = `ref_${randomUUID()}`;

beforeAll(async () => {
  app = await createTestApp();

  const tenant = await prisma.tenant.create({
    data: { name: 'Receipt Fixture', slug: SLUG, status: 'ACTIVE' },
  });
  await prisma.tenant.create({
    data: { name: 'Another Shop', slug: OTHER, status: 'ACTIVE' },
  });
  const tenantId = tenant.id;

  const zone = await prisma.deliveryZone.create({
    data: { tenantId, name: 'Lagos Mainland', feeKobo: 150_000 },
  });
  const product = await prisma.product.create({
    data: {
      tenantId,
      name: 'Ankara Wrap',
      slug: 'ankara-wrap',
      priceKobo: 450_000,
      stock: 5,
      imageUrls: ['tenants/x/products/abc'],
    },
  });

  await prisma.order.create({
    data: {
      tenantId,
      status: 'PAID',
      orderNumber: 7,
      // Lower case on purpose: this is how people type their name into a
      // checkout field, and the greeting has to cope with it.
      customerName: 'chidi okonkwo',
      customerEmail: 'chidi.okonkwo@example.com',
      customerPhone: '08012345678',
      deliveryZoneId: zone.id,
      deliveryAddress: '12 Admiralty Way, Lekki',
      deliveryFeeKobo: 150_000,
      subtotalKobo: 900_000,
      discountKobo: 50_000,
      totalKobo: 1_000_000,
      paymentReference: REFERENCE,
      items: {
        create: [
          {
            productId: product.id,
            quantity: 2,
            productName: 'Ankara Wrap',
            variantLabel: 'Size: M',
            unitPriceKobo: 450_000,
          },
        ],
      },
    },
  });
});

afterAll(async () => {
  // Orders first. `OrderItem.productId` is `onDelete: Restrict` on purpose —
  // deleting a product must never rewrite order history — so cascading the
  // tenant away while an order still points at its products is refused.
  const doomed = await prisma.tenant.findMany({
    where: { slug: { in: [SLUG, OTHER] } },
    select: { id: true },
  });
  await prisma.order.deleteMany({
    where: { tenantId: { in: doomed.map((t) => t.id) } },
  });
  await prisma.tenant.deleteMany({ where: { slug: { in: [SLUG, OTHER] } } });
  await prisma.$disconnect();
  await app.close();
});

const order = (slug = SLUG, reference = REFERENCE) =>
  request(app.getHttpServer()).get(
    `/api/storefront/${slug}/orders/${encodeURIComponent(reference)}`,
  );

describe('GET /api/storefront/:slug/orders/:reference', () => {
  it('returns the receipt a customer needs to check their own order', async () => {
    const res = await order().expect(200);

    expect(res.body.orderNumber).toBe(7);
    expect(res.body.status).toBe('PAID');
    expect(res.body.subtotalKobo).toBe(900_000);
    expect(res.body.discountKobo).toBe(50_000);
    expect(res.body.deliveryFeeKobo).toBe(150_000);
    expect(res.body.totalKobo).toBe(1_000_000);
    expect(res.body.deliveryZoneName).toBe('Lagos Mainland');

    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0]).toMatchObject({
      productName: 'Ankara Wrap',
      variantLabel: 'Size: M',
      quantity: 2,
      unitPriceKobo: 450_000,
      productSlug: 'ankara-wrap',
      imageUrl: 'tenants/x/products/abc',
    });
  });

  it('never ships the contact details or the street address', async () => {
    const res = await order().expect(200);

    // Named individually rather than by a key snapshot, so the reason each one
    // is absent survives someone reading only this test.
    expect(res.body.customerEmail).toBeUndefined();
    expect(res.body.customerPhone).toBeUndefined();
    expect(res.body.customerName).toBeUndefined();
    expect(res.body.deliveryAddress).toBeUndefined();

    // And nothing anywhere in the payload, whatever it is nested under.
    const serialised = JSON.stringify(res.body);
    expect(serialised).not.toContain('chidi.okonkwo@example.com');
    expect(serialised).not.toContain('08012345678');
    expect(serialised).not.toContain('Admiralty');
  });

  it('masks the email and greets by first name only', async () => {
    const res = await order().expect(200);

    expect(res.body.maskedEmail).toBe('c•••o@example.com');
    // Capitalised, and the surname left behind.
    expect(res.body.firstName).toBe('Chidi');
  });

  it('does not resolve under another store, though the reference is unique', async () => {
    await order(OTHER).expect(404);
  });

  it('404s an unknown reference', async () => {
    await order(SLUG, 'ref_nope').expect(404);
  });
});
