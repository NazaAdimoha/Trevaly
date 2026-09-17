'use client';

import { useState } from 'react';

import { cn } from '@/lib/cn';

import ProductGrid, {
  type StorefrontProductCard,
} from '@/components/pages/storefront/home';

/**
 * New arrivals / Best sellers / Sale, in one switchable carousel.
 *
 * Every tab's products are rendered from data the page already fetched, so
 * switching is instant and costs no request — the catalogue for this page came
 * down once. Only the tab strip is interactive, which is why this is the only
 * part that ships as a client component.
 */
export function TabbedProductsSection({
  settings,
  productsByTab,
  storeName,
}: {
  settings: { tabs?: { label?: string | null }[] | null; count?: number | null };
  /** Resolved on the server: one product list per tab, in tab order. */
  productsByTab: StorefrontProductCard[][];
  storeName: string;
}) {
  const tabs = (settings.tabs ?? []).filter((tab) => tab.label);
  const [active, setActive] = useState(0);

  if (tabs.length === 0) return null;

  const products = (productsByTab[active] ?? []).slice(0, settings.count ?? 8);

  return (
    <section className='st-reveal' style={{ paddingBlock: 'var(--st-section-y)' }}>
      <div className='st-container'>
        <div
          className='mb-8 flex flex-wrap justify-center gap-2'
          role='tablist'
          aria-label='Product collections'
        >
          {tabs.map((tab, index) => (
            <button
              key={`${tab.label}-${index}`}
              type='button'
              role='tab'
              aria-selected={active === index}
              onClick={() => setActive(index)}
              className={cn('st-btn px-5 py-2.5 text-sm transition-colors')}
              style={
                active === index
                  ? { background: 'var(--st-accent)', color: 'var(--st-accent-ink)' }
                  : { color: 'var(--st-ink-muted)' }
              }
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div role='tabpanel'>
          <ProductGrid
            products={products}
            storeName={storeName}
            emptyMessage={`Nothing in ${tabs[active]?.label ?? 'this collection'} right now.`}
            bare
          />
        </div>
      </div>
    </section>
  );
}
