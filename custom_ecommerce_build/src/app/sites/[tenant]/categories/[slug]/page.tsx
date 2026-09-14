import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { tenantOrigin, tenantUrl } from '@/lib/domains/canonical';
import { tenantDb } from '@/lib/tenant-db';

import JsonLd from '@/components/JsonLd';
import ProductGrid from '@/components/pages/storefront/home';
import CategoryNav from '@/components/pages/storefront/home/category-nav';

import { resolveStorefrontTenant } from '@/app/sites/_tenant';
import { STOREFRONT_ROUTES } from '@/constant/routes';

type RouteParams = { params: Promise<{ tenant: string; slug: string }> };

/**
 * A category page — the same grid, filtered.
 *
 * A real route rather than a query parameter on the catalogue, for two reasons:
 * it can carry its own canonical and be indexed (a store's categories are the
 * broadest terms it will ever rank for), and it survives being shared in a
 * WhatsApp message, which is how most of this store's traffic arrives.
 */
export async function generateMetadata({
  params,
}: RouteParams): Promise<Metadata> {
  const { tenant: tenantSlug, slug } = await params;
  const tenant = await resolveStorefrontTenant(tenantSlug);
  if (!tenant) return {};

  const category = await tenantDb(tenant.id).category.findFirst({
    where: { slug, isActive: true },
  });
  if (!category) return {};

  const description = `Browse ${category.name.toLowerCase()} at ${tenant.name}. ${
    tenant.tagline ?? 'Order online and pay securely.'
  }`;

  return {
    title: category.name,
    description,
    // Relative to the tenant's `metadataBase`, so it resolves to the store's
    // canonical host rather than whichever host served the request.
    alternates: { canonical: STOREFRONT_ROUTES.category(category.slug) },
    openGraph: {
      type: 'website',
      title: `${category.name} | ${tenant.name}`,
      description,
      url: STOREFRONT_ROUTES.category(category.slug),
    },
  };
}

export default async function StorefrontCategoryPage({ params }: RouteParams) {
  const { tenant: tenantSlug, slug } = await params;
  const tenant = await resolveStorefrontTenant(tenantSlug);
  if (!tenant) notFound();

  const db = tenantDb(tenant.id);

  // tenantId is injected by the wrapper — deliberately absent here.
  const category = await db.category.findFirst({
    where: { slug, isActive: true },
  });
  if (!category) notFound();

  const [categories, products] = await Promise.all([
    db.category.findMany({
      where: { isActive: true },
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, slug: true },
    }),
    db.product.findMany({
      where: { isActive: true, categoryId: category.id },
      include: { variants: true },
      orderBy: { createdAt: 'desc' },
      take: 60,
    }),
  ]);

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
        item: tenantUrl(tenant, STOREFRONT_ROUTES.category(category.slug)),
      },
    ],
  };

  return (
    <>
      <JsonLd data={breadcrumbSchema} />
      <CategoryNav categories={categories} activeSlug={category.slug} />
      <h1 className='mx-auto max-w-6xl px-4 pt-6 text-xl font-semibold'>
        {category.name}
      </h1>
      <ProductGrid
        products={products}
        theme={tenant.theme}
        storeName={tenant.name}
        emptyMessage={`No ${category.name.toLowerCase()} in stock right now.`}
      />
    </>
  );
}
