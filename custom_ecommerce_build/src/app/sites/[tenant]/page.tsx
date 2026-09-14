import { notFound } from 'next/navigation';

import { tenantDb } from '@/lib/tenant-db';

import ProductGrid from '@/components/pages/storefront/home';
import CategoryNav from '@/components/pages/storefront/home/category-nav';

import { resolveStorefrontTenant } from '@/app/sites/_tenant';

/**
 * Storefront home. Catalogue data is fetched in a Server Component so product
 * listings are indexable — page speed and SEO are part of what this tier sells.
 */
export default async function StorefrontHomePage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const tenant = await resolveStorefrontTenant(slug);
  if (!tenant) notFound();

  const db = tenantDb(tenant.id);

  const [categories, products] = await Promise.all([
    db.category.findMany({
      where: { isActive: true },
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, slug: true },
    }),
    db.product.findMany({
      where: { isActive: true },
      // Needed for price and availability: `Product.stock` is meaningless once
      // a product sells by variant. See `@/lib/products/variants`.
      include: { variants: true },
      orderBy: { createdAt: 'desc' },
      take: 60,
    }),
  ]);

  return (
    <>
      <CategoryNav categories={categories} />
      <ProductGrid
        products={products}
        theme={tenant.theme}
        storeName={tenant.name}
      />
    </>
  );
}
