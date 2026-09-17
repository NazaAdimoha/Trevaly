import { notFound } from 'next/navigation';

import ProductGrid from '@/components/pages/storefront/home';
import CategoryNav from '@/components/pages/storefront/home/category-nav';

import { getStorefrontCatalog, resolveStorefrontTenant } from '@/app/sites/_tenant';

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
  const [tenant, catalog] = await Promise.all([
    resolveStorefrontTenant(slug),
    getStorefrontCatalog(slug),
  ]);
  if (!tenant || !catalog) notFound();

  return (
    <>
      <CategoryNav categories={catalog.categories} />
      <ProductGrid
        products={catalog.products}
        theme={tenant.theme}
        storeName={tenant.name}
      />
    </>
  );
}
