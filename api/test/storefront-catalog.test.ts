import { randomUUID } from 'node:crypto';

import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { getEnv } from '../src/config/env';
import { PrismaService } from '../src/database/prisma.service';

import { createTestApp } from './support/app';

/**
 * The collection page's query: sorting, the in-stock filter, the limit, and the
 * count that goes with them.
 *
 * Its own fixture rather than the seed store, because the interesting cases are
 * the ones a healthy shop does not have: something sold out, something whose
 * parent stock is zero but which still has a live size, something whose only
 * in-stock variant has been switched off. A filter is only proved by what it
 * excludes, and the seeded catalogue excludes nothing.
 *
 * `total` is the property most easily got wrong: it must count the MATCHES, not
 * the returned page, or a collection of 90 products announces "60 items".
 */
let app: NestExpressApplication;

const prisma = new PrismaService(getEnv());
const SLUG = `cat-${randomUUID().slice(0, 8)}`;
let tenantId: string;

beforeAll(async () => {
  app = await createTestApp();

  const tenant = await prisma.tenant.create({
    data: { name: 'Catalogue Fixture', slug: SLUG, status: 'ACTIVE' },
  });
  tenantId = tenant.id;

  const shoes = await prisma.category.create({
    data: { tenantId, name: 'Shoes', slug: 'shoes', position: 0 },
  });
  await prisma.category.create({
    data: { tenantId, name: 'Bags', slug: 'bags', position: 1 },
  });

  const product = (data: Record<string, unknown>) =>
    prisma.product.create({ data: { tenantId, ...data } as never });

  // Ascending price is deliberately NOT creation order, so a passing sort
  // assertion cannot be `createdAt` wearing a different name.
  await product({ name: 'Zebra Loafer', slug: 'zebra', priceKobo: 30_000, stock: 4, categoryId: shoes.id });
  await product({ name: 'Anchor Boot', slug: 'anchor', priceKobo: 10_000, stock: 0, categoryId: shoes.id });
  await product({ name: 'Mango Sandal', slug: 'mango', priceKobo: 20_000, stock: 7, categoryId: shoes.id });
  await product({ name: 'Hidden Mule', slug: 'hidden', priceKobo: 5_000, stock: 9, isActive: false, categoryId: shoes.id });

  // Parent stock 0, one live size in stock — buyable, and the case a naive
  // `stock > 0` filter hides from the shopper who came for exactly it.
  const sized = await product({
    name: 'Sized Sneaker',
    slug: 'sized',
    priceKobo: 40_000,
    stock: 0,
    optionName: 'Size',
    categoryId: shoes.id,
  });
  await prisma.productVariant.createMany({
    data: [
      { tenantId, productId: sized.id, value: '41', stock: 0, position: 0 },
      { tenantId, productId: sized.id, value: '42', stock: 3, position: 1 },
    ],
  });

  // Every size gone: not buyable, however many variant rows exist.
  const gone = await product({
    name: 'Gone Slide',
    slug: 'gone',
    priceKobo: 50_000,
    stock: 0,
    optionName: 'Size',
    categoryId: shoes.id,
  });
  await prisma.productVariant.createMany({
    data: [
      { tenantId, productId: gone.id, value: '41', stock: 0, position: 0 },
      // In stock but switched off — a deactivated variant is not inventory.
      { tenantId, productId: gone.id, value: '42', stock: 5, isActive: false, position: 1 },
    ],
  });
});

afterAll(async () => {
  await prisma.tenant.deleteMany({ where: { slug: SLUG } });
  await prisma.$disconnect();
  await app.close();
});

const catalog = (query = '') =>
  request(app.getHttpServer()).get(`/api/storefront/${SLUG}/catalog${query}`);

const slugs = (body: { products: { slug: string }[] }) => body.products.map((p) => p.slug);

describe('GET /api/storefront/:slug/catalog', () => {
  it('returns active products only, newest first by default', async () => {
    const res = await catalog().expect(200);

    expect(slugs(res.body)).toEqual(['gone', 'sized', 'mango', 'anchor', 'zebra']);
    expect(res.body.total).toBe(5);
    expect(slugs(res.body)).not.toContain('hidden');
  });

  it('sorts by price in both directions and by name', async () => {
    const asc = await catalog('?sort=price-asc').expect(200);
    expect(slugs(asc.body)).toEqual(['anchor', 'mango', 'zebra', 'sized', 'gone']);

    const desc = await catalog('?sort=price-desc').expect(200);
    expect(slugs(desc.body)).toEqual(['gone', 'sized', 'zebra', 'mango', 'anchor']);

    const name = await catalog('?sort=name').expect(200);
    expect(slugs(name.body)).toEqual(['anchor', 'gone', 'mango', 'sized', 'zebra']);
  });

  it('ignores a sort it does not know rather than failing the page', async () => {
    const res = await catalog('?sort=vibes').expect(200);
    expect(slugs(res.body)).toEqual(['gone', 'sized', 'mango', 'anchor', 'zebra']);
  });

  it('keeps a product whose only stock is in a live variant, and drops one whose is not', async () => {
    const res = await catalog('?inStock=true&sort=name').expect(200);

    expect(slugs(res.body)).toEqual(['mango', 'sized', 'zebra']);
    expect(slugs(res.body)).not.toContain('anchor'); // sold out outright
    expect(slugs(res.body)).not.toContain('gone'); // every live size gone
    expect(res.body.total).toBe(3);
  });

  it('counts the matches, not the page', async () => {
    const res = await catalog('?limit=2&sort=name').expect(200);

    expect(slugs(res.body)).toEqual(['anchor', 'gone']);
    expect(res.body.total).toBe(5);
  });

  it('caps the limit so one URL cannot ask for the whole database', async () => {
    const res = await catalog('?limit=100000').expect(200);
    expect(res.body.products.length).toBeLessThanOrEqual(120);
  });

  it('narrows to one collection and still lists them all for the pills', async () => {
    const res = await catalog('?category=shoes').expect(200);

    expect(res.body.category.slug).toBe('shoes');
    expect(res.body.total).toBe(5);
    expect(res.body.categories.map((c: { slug: string }) => c.slug)).toEqual(['shoes', 'bags']);
  });

  it('404s an unknown collection rather than quietly showing everything', async () => {
    await catalog('?category=nope').expect(404);
  });
});
