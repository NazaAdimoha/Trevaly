import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import ProductGrid, {
  type StorefrontProductCard,
} from '@/components/pages/storefront/home';

import { apiGet, resolveStorefrontTenant, storefrontApiPath } from '@/app/sites/_tenant';

export const metadata: Metadata = {
  title: 'Search',
  // Thin, near-duplicate pages. Useful to a shopper, noise to an index.
  robots: { index: false },
};

/**
 * Search results.
 *
 * A real URL rather than a filter in place: a shopper who finds the thing wants
 * to send that link to whoever asked about it, and that is how most of this
 * store's traffic moves.
 */
export default async function StorefrontSearchPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenant: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const [{ tenant: slug }, { q }] = await Promise.all([params, searchParams]);
  const tenant = await resolveStorefrontTenant(slug);
  if (!tenant) notFound();

  const query = (q ?? '').trim();
  const { products } = query
    ? await apiGet<{ products: StorefrontProductCard[] }>(
        storefrontApiPath(slug, `/search?q=${encodeURIComponent(query)}`),
      )
    : { products: [] };

  return (
    <div className='st-container' style={{ paddingBlock: 'var(--st-section-y)' }}>
      <h1 className='st-display text-2xl md:text-3xl'>
        {query ? `Results for “${query}”` : 'Search'}
      </h1>
      <p className='st-muted mt-2 text-sm'>
        {query
          ? `${products.length} ${products.length === 1 ? 'product' : 'products'}`
          : 'Type what you are looking for in the search box.'}
      </p>

      <div className='mt-8'>
        <ProductGrid
          products={products}
          storeName={tenant.name}
          emptyMessage={
            query
              ? `Nothing matched “${query}”. Try a shorter word, or browse the categories.`
              : undefined
          }
          bare
        />
      </div>
    </div>
  );
}
