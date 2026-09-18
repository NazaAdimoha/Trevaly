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
import { toMajor } from '@/lib/utils';

import JsonLd from '@/components/JsonLd';
import ProductGrid from '@/components/pages/storefront/home';
import ProductDetailView from '@/components/pages/storefront/product-detail';
import { SectionRenderer } from '@/components/pages/storefront/sections';

import {
  getStorefrontCatalog,
  getStorefrontLayout,
  getStorefrontProduct,
  resolveStorefrontTenant,
} from '@/app/sites/_tenant';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tenant: string; slug: string }>;
}): Promise<Metadata> {
  const { tenant: tenantSlug, slug } = await params;
  const tenant = await resolveStorefrontTenant(tenantSlug);
  if (!tenant) return {};

  const product = await getStorefrontProduct(tenantSlug, slug);
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

  const [product, layout] = await Promise.all([
    getStorefrontProduct(tenantSlug, slug),
    getStorefrontLayout(tenantSlug, tenant.theme),
  ]);
  if (!product) notFound();

  const sections = layout.pages.product.filter((section) => section.visible);

  /**
   * The catalogue is only fetched when the merchant has actually put sections
   * on this page. A product page that shows nothing but the product should not
   * pay for a second round trip to find that out.
   */
  const catalog = sections.length > 0 ? await getStorefrontCatalog(tenantSlug) : null;

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

      {/* "Pairs well with" — the rest of the collection this product sits in.
          It arrives on the same API response as the product, so the row costs
          markup and nothing else, and it is the cheapest way to turn a dead end
          into a second page view. */}
      {product.related.length > 0 ? (
        <section
          className='st-reveal st-hairline border-t'
          style={{ paddingBlock: 'var(--st-section-y)' }}
        >
          <div className='st-container'>
            <h2 className='st-display mb-6 text-2xl md:text-3xl'>
              {product.category ? `More in ${product.category.name}` : 'You may also like'}
            </h2>
            <ProductGrid
              products={product.related}
              storeName={tenant.name}
              className='grid-flow-col auto-cols-[minmax(60%,1fr)] overflow-x-auto sm:auto-cols-[minmax(32%,1fr)] lg:auto-cols-[minmax(22%,1fr)]'
              bare
            />
          </div>
        </section>
      ) : null}

      {/* Whatever the merchant arranged beneath every product: a size guide,
          the care instructions, the delivery promise, their reviews. */}
      {catalog ? (
        <SectionRenderer
          sections={sections}
          products={catalog.products}
          categories={catalog.categories}
          storeName={tenant.name}
        />
      ) : null}
    </>
  );
}
