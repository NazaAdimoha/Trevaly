import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { tenantOrigin, tenantUrl } from '@/lib/domains/canonical';

import JsonLd from '@/components/JsonLd';
import { CollectionView } from '@/components/pages/storefront/collection';
import { parseCollectionQuery } from '@/components/pages/storefront/collection/toolbar';

import {
  getStorefrontCatalog,
  getStorefrontLayout,
  resolveStorefrontTenant,
} from '@/app/sites/_tenant';
import { STOREFRONT_ROUTES } from '@/constant/routes';

type RouteParams = {
  params: Promise<{ tenant: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * Everything the store sells.
 *
 * This route did not exist and it was reachable: a hero's second button
 * defaults to "Browse all", the section editor offers `/products` as a link,
 * and this store's own published layout pointed two CTAs at it. A shopper who
 * followed the most prominent link under the headline got a 404 — on the one
 * page a storefront cannot afford to lose them.
 *
 * It is the collection page with no `where` clause, so it shares every control
 * with `/categories/[slug]`: sort, in-stock, density, and the pills that move
 * sideways into a category.
 */
export async function generateMetadata({ params }: RouteParams): Promise<Metadata> {
  const { tenant: tenantSlug } = await params;
  const tenant = await resolveStorefrontTenant(tenantSlug);
  if (!tenant) return {};

  const description =
    tenant.tagline ?? `Browse everything ${tenant.name} sells and order online.`;

  return {
    title: 'All products',
    description,
    // Deliberately WITHOUT the sort and filter parameters: they are the same
    // products in a different order, and indexing each permutation splits this
    // page's ranking between copies of itself.
    alternates: { canonical: STOREFRONT_ROUTES.products },
    openGraph: {
      type: 'website',
      title: `All products | ${tenant.name}`,
      description,
      url: STOREFRONT_ROUTES.products,
    },
  };
}

export default async function StorefrontAllProductsPage({
  params,
  searchParams,
}: RouteParams) {
  const { tenant: tenantSlug } = await params;
  const query = parseCollectionQuery(await searchParams);

  const tenant = await resolveStorefrontTenant(tenantSlug);
  if (!tenant) notFound();

  const [catalog, layout] = await Promise.all([
    // No `category`: the API sorts and filters the whole catalogue, and returns
    // `total` counted before the limit so the count is the shop's, not the page's.
    getStorefrontCatalog(tenantSlug, {
      sort: query.sort,
      inStock: query.inStock,
      limit: 120,
    }),
    getStorefrontLayout(tenantSlug, tenant.theme),
  ]);
  if (!catalog) notFound();

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: tenant.name,
        item: tenantOrigin(tenant),
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'All products',
        item: tenantUrl(tenant, STOREFRONT_ROUTES.products),
      },
    ],
  };

  return (
    <>
      <JsonLd data={breadcrumbSchema} />
      <CollectionView
        title='All products'
        intro={tenant.tagline ?? undefined}
        base={STOREFRONT_ROUTES.products}
        query={query}
        products={catalog.products}
        total={catalog.total}
        categories={catalog.categories}
        storeName={tenant.name}
        emptyMessage={
          query.inStock
            ? 'Everything is sold out right now. Turn off "in stock only" to see it all.'
            : `${tenant.name} is still adding products. Check back shortly.`
        }
        sections={layout.pages.collection.filter((section) => section.visible)}
      />
    </>
  );
}
