import type { Section } from '@core/storefront/layout';

import ProductGrid from '@/components/pages/storefront/home';
import { SectionRenderer } from '@/components/pages/storefront/sections';

import type { StorefrontProduct } from '@/app/sites/_tenant';

import {
  type CollectionQuery,
  CollectionToolbar,
  densityVars,
} from './toolbar';

export type CollectionCategory = { id: string; name: string; slug: string };

/**
 * A collection page: a heading, the toolbar, the grid, then the merchant's
 * sections.
 *
 * Shared by `/categories/[slug]` and `/products`, because those two are the
 * same page with a different `where`. Keeping them as separate copies is how
 * "sort works in a category but not in Browse all" happens — and Browse all is
 * the link a hero puts under its headline, so it is the one that gets used.
 */
export function CollectionView({
  title,
  intro,
  base,
  query,
  products,
  total,
  categories,
  activeSlug,
  storeName,
  emptyMessage,
  sections,
}: {
  title: string;
  intro?: string;
  /** This collection's own path, without a query string. */
  base: string;
  query: CollectionQuery;
  products: StorefrontProduct[];
  total: number;
  categories: CollectionCategory[];
  /** Absent on "everything", which is what makes the "All" pill the active one. */
  activeSlug?: string;
  storeName: string;
  emptyMessage: string;
  sections: Section[];
}) {
  return (
    <>
      <header className='st-container' style={{ paddingTop: 'var(--st-section-y)' }}>
        <h1 className='st-display text-3xl md:text-4xl'>{title}</h1>
        {intro ? <p className='st-muted mt-3 max-w-prose text-sm'>{intro}</p> : null}
      </header>

      <CollectionToolbar
        base={base}
        query={query}
        total={total}
        siblings={categories}
        activeSlug={activeSlug}
      />

      {/* Density is three custom properties on this wrapper — the grid already
          reads its column counts from tokens, so a shopper changing how much
          they see costs no new CSS and no JavaScript. */}
      {/* `bare`, with the spacing owned here. The grid's own wrapper adds a
          full section's padding, which lands directly under the toolbar's —
          two stacked paddings that read as a gap where the products should be,
          and worst on `roomy`, where each one is 6rem. */}
      <div
        className='st-container'
        style={{ ...densityVars(query.density), paddingBlock: 'var(--st-gap, 1.5rem)' }}
      >
        <ProductGrid
          products={products}
          storeName={storeName}
          emptyMessage={emptyMessage}
          bare={products.length > 0}
        />
      </div>

      {/* Whatever the merchant put beneath every collection: the sizing note,
          the delivery promise, the story behind the range. */}
      {sections.length > 0 ? (
        <SectionRenderer
          sections={sections}
          products={products}
          categories={categories}
          storeName={storeName}
        />
      ) : null}
    </>
  );
}
