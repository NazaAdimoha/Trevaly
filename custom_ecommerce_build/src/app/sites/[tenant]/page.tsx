import { notFound } from 'next/navigation';

import ProductGrid from '@/components/pages/storefront/home';
import CategoryNav from '@/components/pages/storefront/home/category-nav';
import { SectionRenderer } from '@/components/pages/storefront/sections';

import {
  getStorefrontCatalog,
  getStorefrontLayout,
  resolveStorefrontTenant,
} from '@/app/sites/_tenant';

/**
 * Storefront home.
 *
 * The page no longer decides what a home page is — the merchant does, through
 * the sections they arranged. Everything still renders on the server, so the
 * page search engines index is the page a shopper sees.
 *
 * The catalogue is fetched once here and handed to the sections rather than
 * each section fetching its own: eight sections that each ask for products is
 * eight round trips for one page.
 */
export default async function StorefrontHomePage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const tenant = await resolveStorefrontTenant(slug);
  if (!tenant) notFound();

  const [catalog, layout] = await Promise.all([
    getStorefrontCatalog(slug),
    getStorefrontLayout(slug, tenant.theme),
  ]);
  if (!catalog) notFound();

  const sections = layout.pages.home.filter((section) => section.visible);

  return (
    <>
      <CategoryNav categories={catalog.categories} />

      {sections.length > 0 ? (
        <SectionRenderer
          sections={sections}
          products={catalog.products}
          storeName={tenant.name}
        />
      ) : (
        // A store whose layout is empty still has a shop: its catalogue.
        <ProductGrid products={catalog.products} storeName={tenant.name} />
      )}
    </>
  );
}
