import Link from 'next/link';

import { cn } from '@/lib/utils';

import ProductGrid, {
  type StorefrontProductCard,
} from '@/components/pages/storefront/home';

import { STOREFRONT_ROUTES } from '@/constant/routes';

/**
 * Products from a collection: a grid, a carousel, or a ranked list.
 *
 * A Server Component, like the grid it wraps — this is the markup search
 * engines index, and the moment it takes a click handler it costs every shopper
 * a JavaScript download for a page that is a list of links.
 *
 * `ranked` is the Top-10 treatment: an oversized numeral behind each card. It
 * reads as a recommendation rather than a shelf, which is why it converts, and
 * it costs one pseudo-element.
 */
export function CollectionRowSection({
  settings,
  products,
  storeName,
}: {
  settings: {
    heading?: string | null;
    eyebrow?: string | null;
    layout?: string | null;
    count?: number | null;
    ctaLabel?: string | null;
    ctaHref?: string | null;
    collection?: string | null;
  };
  products: StorefrontProductCard[];
  storeName: string;
}) {
  const layout = settings.layout ?? 'grid';
  const shown = products.slice(0, settings.count ?? 8);

  if (shown.length === 0) return null;

  return (
    <section className='st-reveal' style={{ paddingBlock: 'var(--st-section-y)' }}>
      <div className='st-container'>
        {settings.eyebrow || settings.heading || settings.ctaLabel ? (
          <div className='mb-6 flex flex-wrap items-end justify-between gap-3'>
            <div>
              {settings.eyebrow ? (
                <p className='st-muted mb-2 text-xs font-medium tracking-[0.18em] uppercase'>
                  {settings.eyebrow}
                </p>
              ) : null}
              {settings.heading ? (
                <h2 className='st-display text-2xl md:text-3xl'>{settings.heading}</h2>
              ) : null}
            </div>

            {settings.ctaLabel ? (
              <Link
                href={settings.ctaHref || STOREFRONT_ROUTES.home}
                className='st-btn st-btn-outline text-sm'
              >
                {settings.ctaLabel}
              </Link>
            ) : null}
          </div>
        ) : null}

        <ProductGrid
          products={shown}
          storeName={storeName}
          ranked={layout === 'ranked'}
          // A carousel is a grid that scrolls sideways on small screens; the
          // markup and the SEO are identical either way.
          className={cn(
            layout === 'carousel' &&
              'grid-flow-col auto-cols-[minmax(70%,1fr)] overflow-x-auto sm:auto-cols-[minmax(38%,1fr)] lg:auto-cols-[minmax(24%,1fr)]',
          )}
          bare
        />
      </div>
    </section>
  );
}
