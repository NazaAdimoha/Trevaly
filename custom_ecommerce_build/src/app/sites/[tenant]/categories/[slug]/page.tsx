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
  params: Promise<{ tenant: string; slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * A collection page — the same grid, filtered, sorted, and at the density the
 * shopper asked for.
 *
 * A real route rather than a query parameter on the catalogue, for two reasons:
 * it can carry its own canonical and be indexed (a store's collections are the
 * broadest terms it will ever rank for), and it survives being shared in a
 * WhatsApp message, which is how most of this store's traffic arrives.
 */
export async function generateMetadata({ params }: RouteParams): Promise<Metadata> {
  const { tenant: tenantSlug, slug } = await params;
  const tenant = await resolveStorefrontTenant(tenantSlug);
  if (!tenant) return {};

  const category = (await getStorefrontCatalog(tenantSlug, { category: slug }))?.category;
  if (!category) return {};

  const description = `Browse ${category.name.toLowerCase()} at ${tenant.name}. ${
    tenant.tagline ?? 'Order online and pay securely.'
  }`;

  return {
    title: category.name,
    description,
    // Relative to the tenant's `metadataBase`, so it resolves to the store's
    // canonical host rather than whichever host served the request. Deliberately
    // WITHOUT the sort and filter parameters: they are the same products in a
    // different order, and indexing each permutation splits the page's own
    // ranking between four copies of itself.
    alternates: { canonical: STOREFRONT_ROUTES.category(category.slug) },
    openGraph: {
      type: 'website',
      title: `${category.name} | ${tenant.name}`,
      description,
      url: STOREFRONT_ROUTES.category(category.slug),
    },
  };
}

export default async function StorefrontCategoryPage({ params, searchParams }: RouteParams) {
  const { tenant: tenantSlug, slug } = await params;
  const query = parseCollectionQuery(await searchParams);

  const tenant = await resolveStorefrontTenant(tenantSlug);
  if (!tenant) notFound();

  // The API scopes every read to this store, answers 404 for a collection that
  // does not exist or is hidden, and does the sorting and the in-stock filter
  // itself — see `getStorefrontCatalog` for why that cannot happen here.
  const [catalog, layout] = await Promise.all([
    getStorefrontCatalog(tenantSlug, {
      category: slug,
      sort: query.sort,
      inStock: query.inStock,
    }),
    getStorefrontLayout(tenantSlug, tenant.theme),
  ]);
  const category = catalog?.category;
  if (!catalog || !category) notFound();
  const { categories, products, total } = catalog;

  const sections = layout.pages.collection.filter((section) => section.visible);
  const base = STOREFRONT_ROUTES.category(category.slug);

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
        name: category.name,
        item: tenantUrl(tenant, base),
      },
    ],
  };

  return (
    <>
      <JsonLd data={breadcrumbSchema} />
      <CollectionView
        title={category.name}
        base={base}
        query={query}
        products={products}
        total={total}
        categories={categories}
        activeSlug={category.slug}
        storeName={tenant.name}
        emptyMessage={
          query.inStock
            ? `Everything in ${category.name.toLowerCase()} is sold out right now. Turn off "in stock only" to see it all.`
            : `No ${category.name.toLowerCase()} in stock right now.`
        }
        sections={sections}
      />
    </>
  );
}
