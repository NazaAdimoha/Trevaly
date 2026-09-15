import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';

import {
  CouponType,
  PrismaClient,
  TenantStatus,
} from '../src/generated/prisma/client';

// Seeding writes schema-shaped data, so it uses the unpooled connection for the
// same reason migrations do.
const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connectionString)
  throw new Error('DIRECT_URL or DATABASE_URL must be set');

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

/**
 * Seeds TWO tenants deliberately.
 *
 * A single-tenant seed cannot prove isolation — every query looks correct when
 * there is nothing to leak. The isolation tests in `src/lib/__tests__` depend on
 * both of these existing.
 */
const TENANTS = [
  {
    slug: 'adaobi-store',
    name: 'Adaobi Fashion Store',
    primaryColor: '#7C3AED',
    tagline: 'Ready-to-wear, delivered across Lagos',
    products: [
      { name: 'Ankara Midi Dress', priceKobo: 2_500_000, stock: 12 },
      { name: 'Silk Head Wrap', priceKobo: 450_000, stock: 40 },
      { name: 'Beaded Clutch Bag', priceKobo: 1_200_000, stock: 8 },
    ],
    zones: [
      { name: 'Lagos Mainland', feeKobo: 150_000 },
      { name: 'Lagos Island', feeKobo: 200_000 },
      { name: 'Other States', feeKobo: 450_000 },
    ],
    coupon: { code: 'WELCOME10', type: CouponType.PERCENTAGE, value: 10 },
  },
  {
    slug: 'chidi-electronics',
    name: 'Chidi Electronics',
    primaryColor: '#0EA5E9',
    tagline: 'Genuine gadgets, verified warranty',
    products: [
      { name: 'Wireless Earbuds Pro', priceKobo: 4_500_000, stock: 25 },
      { name: 'Fast Charger 65W', priceKobo: 1_800_000, stock: 60 },
      { name: 'Bluetooth Speaker', priceKobo: 3_200_000, stock: 15 },
    ],
    zones: [
      { name: 'Within Enugu', feeKobo: 100_000 },
      { name: 'South East', feeKobo: 250_000 },
      { name: 'Nationwide', feeKobo: 500_000 },
    ],
    // Same code as the other tenant on purpose: coupon codes are unique
    // per-tenant, and this row proves the constraint allows it.
    coupon: { code: 'WELCOME10', type: CouponType.FIXED, value: 500_000 },
  },
];

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

async function main() {
  for (const definition of TENANTS) {
    const tenant = await prisma.tenant.upsert({
      where: { slug: definition.slug },
      update: {},
      create: {
        slug: definition.slug,
        name: definition.name,
        status: TenantStatus.ACTIVE,
        primaryColor: definition.primaryColor,
        tagline: definition.tagline,
        contactEmail: `hello@${definition.slug}.test`,
        platformFeePercent: 1.0,
        // Replace with a real ACCT_ code from Paystack at onboarding.
        paystackSubaccountCode: `ACCT_seed_${definition.slug}`,
      },
    });

    for (const product of definition.products) {
      const slug = slugify(product.name);
      await prisma.product.upsert({
        where: { tenantId_slug: { tenantId: tenant.id, slug } },
        update: {},
        create: { ...product, slug, tenantId: tenant.id },
      });
    }

    for (const [index, zone] of definition.zones.entries()) {
      const existing = await prisma.deliveryZone.findFirst({
        where: { tenantId: tenant.id, name: zone.name },
      });
      if (!existing) {
        await prisma.deliveryZone.create({
          data: { ...zone, position: index, tenantId: tenant.id },
        });
      }
    }

    await prisma.coupon.upsert({
      where: {
        tenantId_code: { tenantId: tenant.id, code: definition.coupon.code },
      },
      update: {},
      create: { ...definition.coupon, tenantId: tenant.id, maxUses: 100 },
    });

    // eslint-disable-next-line no-console
    console.log(`seeded ${tenant.name} -> ${tenant.slug}`);
  }
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
