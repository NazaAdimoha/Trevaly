import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import {
  activeVariants,
  displayPriceKobo,
  hasPriceRange,
  isSoldOut,
  variantPriceKobo,
} from '@core/variants';

import { tenantOrigin, tenantUrl } from '@/lib/domains/canonical';
import { tenantDb } from '@/lib/tenant-db';
import { toMajor } from '@/lib/utils';

import JsonLd from '@/components/JsonLd';
import ProductDetailView from '@/components/pages/storefront/product-detail';

import { resolveStorefrontTenant } from '@/app/sites/_tenant';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tenant: string; slug: string }>;
}): Promise<Metadata> {
  const { tenant: tenantSlug, slug } = await params;
  const tenant = await resolveStorefrontTenant(tenantSlug);
  if (!tenant) return {};

  const product = await tenantDb(tenant.id).product.findFirst({
    where: { slug, isActive: true },
  });
  if (!product) return {};

  return {
    title: product.name,
    description: product.description ?? undefined,
    // Relative to the tenant's `metadataBase`, set in the storefront layout, so
    // this resolves to the store's canonical host rather than the request host.
    alternates: { canonical: `/products/${product.slug}` },
    openGraph: {
      type: 'website',
      title: product.name,
      description: product.description ?? undefined,
      url: `/products/${product.slug}`,
      images: product.imageUrls.slice(0, 1),
    },
  };
}

export default async function StorefrontProductPage({
  params,
}: {
  params: Promise<{ tenant: string; slug: string }>;
}) {
  const { tenant: tenantSlug, slug } = await params;
  const tenant = await resolveStorefrontTenant(tenantSlug);
  if (!tenant) notFound();

  const product = await tenantDb(tenant.id).product.findFirst({
    where: { slug, isActive: true },
    include: { variants: true },
  });
  if (!product) notFound();

  const url = tenantUrl(tenant, `/products/${product.slug}`);

  /**
   * Product structured data — the highest-return SEO work in the system.
   *
   * ~30 products across every tenant is the catalogue that actually earns
   * search traffic, and price plus availability in the result is the
   * difference between a listing and a click. Both are read from the same
   * record the page renders, so they cannot drift from what the shopper sees —
   * a mismatch there is not a missed opportunity, it is a manual action.
   */
  const productSchema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    ...(product.description ? { description: product.description } : {}),
    ...(product.sku ? { sku: product.sku } : {}),
    ...(product.imageUrls.length ? { image: product.imageUrls } : {}),
    brand: { '@type': 'Brand', name: tenant.name },
    // AggregateOffer when the live variants disagree on price, so a rich
    // result shows a range rather than asserting one price we might not honour.
    offers: hasPriceRange(product)
      ? {
          '@type': 'AggregateOffer',
          url,
          priceCurrency: tenant.currency,
          lowPrice: toMajor(displayPriceKobo(product)).toFixed(2),
          highPrice: toMajor(
            Math.max(
              ...activeVariants(product).map((v) =>
                variantPriceKobo(product, v),
              ),
            ),
          ).toFixed(2),
          offerCount: activeVariants(product).length,
          availability: isSoldOut(product)
            ? 'https://schema.org/OutOfStock'
            : 'https://schema.org/InStock',
          seller: { '@type': 'Organization', name: tenant.name },
        }
      : {
          '@type': 'Offer',
          url,
          priceCurrency: tenant.currency,
          price: toMajor(displayPriceKobo(product)).toFixed(2),
          availability: isSoldOut(product)
            ? 'https://schema.org/OutOfStock'
            : 'https://schema.org/InStock',
          seller: { '@type': 'Organization', name: tenant.name },
        },
  };

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
      { '@type': 'ListItem', position: 2, name: product.name, item: url },
    ],
  };

  return (
    <>
      <JsonLd data={productSchema} />
      <JsonLd data={breadcrumbSchema} />
      <ProductDetailView product={product} />
    </>
  );
}
