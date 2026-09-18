import { Check, ChevronDown, LayoutGrid, Rows3 } from 'lucide-react';
import Link from 'next/link';

import { cn } from '@/lib/cn';

import { STOREFRONT_ROUTES } from '@/constant/routes';

export type CollectionSort = 'newest' | 'price-asc' | 'price-desc' | 'name';
export type CollectionDensity = 'comfortable' | 'compact';

export type CollectionQuery = {
  sort: CollectionSort;
  inStock: boolean;
  density: CollectionDensity;
};

const NEWEST = { value: 'newest', label: 'Newest first' } as const;

const SORTS: { value: CollectionSort; label: string }[] = [
  NEWEST,
  { value: 'price-asc', label: 'Price, low to high' },
  { value: 'price-desc', label: 'Price, high to low' },
  { value: 'name', label: 'Alphabetical' },
];

/**
 * Builds the URL for one changed control, keeping the others.
 *
 * Defaults are OMITTED rather than written out, so the plain collection URL is
 * what a shopper copies into WhatsApp and what search engines index — a link
 * that says `?sort=newest&density=comfortable` is the same page wearing a
 * different address, and that is how a catalogue ends up indexed four times.
 */
function hrefFor(base: string, query: CollectionQuery, change: Partial<CollectionQuery>): string {
  const next = { ...query, ...change };
  const params = new URLSearchParams();
  if (next.sort !== 'newest') params.set('sort', next.sort);
  if (next.inStock) params.set('inStock', '1');
  if (next.density !== 'comfortable') params.set('density', next.density);
  const search = params.toString();
  return search ? `${base}?${search}` : base;
}

/**
 * The bar above a collection: what is in it, how it is ordered, how densely.
 *
 * Every control is a LINK, and the whole thing is a Server Component. That is
 * not purity for its own sake — a filtered collection has to be a URL. It is
 * how a merchant sends "here are the bags under ₦20,000" to a customer, how the
 * back button behaves, and how these pages get indexed at all. A client-side
 * filter would also be lying: it can only reorder the products already on the
 * page, so "price, low to high" over the first 60 of 200 products shows the
 * cheapest of a slice, not the cheapest in the shop.
 *
 * The phone layout puts the same links inside a `<details>` sheet, which needs
 * no JavaScript and no focus management because the browser owns both.
 */
export function CollectionToolbar({
  base,
  query,
  total,
  siblings,
  activeSlug,
}: {
  /** The collection's own path, without a query string. */
  base: string;
  query: CollectionQuery;
  /** Matches before any limit, so the count is the truth about the shop. */
  total: number;
  /** The other collections, as pills — how a shopper moves sideways. */
  siblings: { id: string; name: string; slug: string }[];
  activeSlug?: string;
}) {
  const href = (change: Partial<CollectionQuery>) => hrefFor(base, query, change);
  const activeSort = SORTS.find((sort) => sort.value === query.sort) ?? NEWEST;

  return (
    <div className='st-container' style={{ paddingBlock: 'calc(var(--st-section-y) * 0.5)' }}>
      {siblings.length > 0 ? (
        <ul className='-mx-1 mb-5 flex list-none gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'>
          <Pill href={STOREFRONT_ROUTES.home} active={!activeSlug}>
            All
          </Pill>
          {siblings.map((sibling) => (
            <Pill
              key={sibling.id}
              href={STOREFRONT_ROUTES.category(sibling.slug)}
              active={sibling.slug === activeSlug}
            >
              {sibling.name}
            </Pill>
          ))}
        </ul>
      ) : null}

      <div className='st-hairline flex items-center justify-between gap-4 border-y py-3'>
        <p className='st-muted text-sm tabular-nums'>
          {total} {total === 1 ? 'item' : 'items'}
        </p>

        <div className='flex items-center gap-2'>
          {/* Desktop: sort as a hover/focus menu, in stock as a toggle. */}
          <Link
            href={href({ inStock: !query.inStock })}
            aria-pressed={query.inStock}
            className={cn(
              'st-control hidden items-center gap-2 px-3 py-2 text-sm md:inline-flex',
            )}
            style={{
              border: '1px solid var(--st-line)',
              ...(query.inStock
                ? { background: 'var(--st-ink)', color: 'var(--st-bg)' }
                : {}),
            }}
          >
            <Check className={cn('size-3.5', !query.inStock && 'opacity-30')} aria-hidden />
            In stock only
          </Link>

          <details className='st-sort relative'>
            <summary
              className='st-control flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-sm'
              style={{ border: '1px solid var(--st-line)' }}
            >
              <span className='hidden sm:inline'>Sort:</span>
              {activeSort.label}
              <ChevronDown className='size-3.5' aria-hidden />
            </summary>
            <ul
              className='absolute right-0 z-20 mt-2 w-56 list-none p-1 shadow-lg'
              style={{
                background: 'var(--st-bg)',
                border: '1px solid var(--st-line)',
                borderRadius: 'var(--st-radius-control)',
              }}
            >
              {SORTS.map((sort) => (
                <li key={sort.value}>
                  <Link
                    href={href({ sort: sort.value })}
                    aria-current={sort.value === query.sort ? 'true' : undefined}
                    className='flex items-center justify-between px-3 py-2 text-sm transition-opacity hover:opacity-60'
                  >
                    {sort.label}
                    {sort.value === query.sort ? (
                      <Check className='size-3.5' aria-hidden />
                    ) : null}
                  </Link>
                </li>
              ))}
              {/* The in-stock filter lives in this sheet on a phone, where
                  there is no room for a second control beside it. */}
              <li className='st-hairline mt-1 border-t pt-1 md:hidden'>
                <Link
                  href={href({ inStock: !query.inStock })}
                  className='flex items-center justify-between px-3 py-2 text-sm transition-opacity hover:opacity-60'
                >
                  In stock only
                  {query.inStock ? <Check className='size-3.5' aria-hidden /> : null}
                </Link>
              </li>
            </ul>
          </details>

          {/* Density. Two columns on a phone is the default because the
              photograph is the product; shoppers who are scanning for one thing
              they already know want four. */}
          <Link
            href={href({
              density: query.density === 'compact' ? 'comfortable' : 'compact',
            })}
            aria-label={
              query.density === 'compact' ? 'Show larger images' : 'Show more per row'
            }
            className='st-control p-2 transition-opacity hover:opacity-60'
            style={{ border: '1px solid var(--st-line)' }}
          >
            {query.density === 'compact' ? (
              <LayoutGrid className='size-4' aria-hidden />
            ) : (
              <Rows3 className='size-4' aria-hidden />
            )}
          </Link>
        </div>
      </div>
    </div>
  );
}

function Pill({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <li className='shrink-0'>
      <Link
        href={href}
        aria-current={active ? 'page' : undefined}
        className='st-control inline-flex min-h-9 items-center px-4 text-sm whitespace-nowrap transition-colors'
        style={{
          border: '1px solid var(--st-line)',
          ...(active ? { background: 'var(--st-ink)', color: 'var(--st-bg)' } : {}),
        }}
      >
        {children}
      </Link>
    </li>
  );
}

/** Column counts for a density, as token overrides on the grid's wrapper. */
export function densityVars(density: CollectionDensity): React.CSSProperties {
  if (density !== 'compact') return {};
  return {
    '--st-cols-sm': 3,
    '--st-cols-md': 4,
    '--st-cols-lg': 5,
  } as React.CSSProperties;
}

/** Reads the query string a collection page was asked for, defaults and all. */
export function parseCollectionQuery(
  search: Record<string, string | string[] | undefined>,
): CollectionQuery {
  const one = (key: string) => {
    const value = search[key];
    return Array.isArray(value) ? value[0] : value;
  };
  const sort = one('sort');
  const density = one('density');
  return {
    sort: SORTS.some((option) => option.value === sort) ? (sort as CollectionSort) : 'newest',
    inStock: one('inStock') === '1' || one('inStock') === 'true',
    density: density === 'compact' ? 'compact' : 'comfortable',
  };
}
