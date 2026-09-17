import Link from 'next/link';

import {
  displayPriceKobo,
  hasPriceRange,
  isSoldOut,
  type VariantLike,
} from '@core/variants';

import { cn, formatCurrency } from '@/lib/utils';

import { ProductImage } from '@/components/ui/product-image';

import { STOREFRONT_ROUTES } from '@/constant/routes';

export type StorefrontProductCard = {
  id: string;
  name: string;
  slug: string;
  sku: string | null;
  priceKobo: number;
  stock: number;
  optionName: string | null;
  imageUrls: string[];
  variants: VariantLike[];
};

/**
 * Storefront catalogue grid.
 *
 * Every visual difference between stores comes from the `st-*` classes and the
 * preset's custom properties — the markup is identical everywhere, which is
 * what keeps this one component rather than one per look.
 *
 * A Server Component, and it must stay one. The store name arrives as a prop
 * rather than from `useTenant()` for that reason alone: reading the client
 * context here would force `'use client'` onto the catalogue, shipping
 * JavaScript for a page that is pure markup and is the page search engines
 * actually index.
 */
export default function ProductGrid({
  products,
  storeName,
  emptyMessage,
  ranked = false,
  bare = false,
  className,
}: {
  products: StorefrontProductCard[];
  storeName: string;
  /** Overrides the day-one copy when the grid is filtered to a category. */
  emptyMessage?: string;
  /** Oversized numerals behind each card — the "Top 10" treatment. */
  ranked?: boolean;
  /** Inside a section that already owns the container and spacing. */
  bare?: boolean;
  className?: string;
}) {
  if (products.length === 0) {
    return (
      <div className='st-container py-24 text-center'>
        <p className='st-display text-lg'>Nothing here just yet</p>
        <p className='st-muted mx-auto mt-2 max-w-sm text-sm'>
          {emptyMessage ??
            `${storeName} is still adding products. Check back shortly — or message us and we will tell you what is coming.`}
        </p>
      </div>
    );
  }

  const grid = (
    <ul className={cn('st-grid list-none p-0', className)}>
      {products.map((product, index) => {
        const [cover] = product.imageUrls;
        // Availability comes from the variants when there are any: selling the
        // last size 42 must not mark size 40 sold out.
        const soldOut = isSoldOut(product);
        const fromPrice = hasPriceRange(product);

        return (
          <li key={product.id} className='st-enter' style={{ '--st-index': index } as never}>
            <Link
              href={STOREFRONT_ROUTES.product(product.slug)}
              className='st-card group relative h-full'
            >
              {ranked ? (
                <span
                  aria-hidden
                  className='st-display pointer-events-none absolute -top-2 -left-1 z-10 text-5xl leading-none opacity-15'
                >
                  {index + 1}
                </span>
              ) : null}

              <div className='st-media'>
                {cover ? (
                  <ProductImage
                    src={cover}
                    alt={product.name}
                    sizes='(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw'
                  />
                ) : (
                  <ImagePlaceholder />
                )}
                {soldOut ? (
                  <span
                    className='absolute top-2 left-2 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase'
                    style={{
                      borderRadius: 'var(--st-radius-control)',
                      background: 'var(--st-ink)',
                      color: 'var(--st-bg)',
                    }}
                  >
                    Sold out
                  </span>
                ) : null}
              </div>

              <h3 className='st-product-name'>{product.name}</h3>

              <p className='st-product-price mt-1'>
                {fromPrice ? (
                  <span className='mr-1 text-[0.85em] font-normal opacity-70'>From</span>
                ) : null}
                {formatCurrency(displayPriceKobo(product))}
              </p>
            </Link>
          </li>
        );
      })}
    </ul>
  );

  return bare ? grid : <div className='st-section st-container'>{grid}</div>;
}

/**
 * A designed empty state rather than a grey square. Tenants launch with
 * unphotographed products routinely, and a blank tile reads as a broken page.
 */
function ImagePlaceholder() {
  return (
    <div className='st-muted absolute inset-0 flex items-center justify-center opacity-40'>
      <svg width='40' height='40' viewBox='0 0 40 40' fill='none' aria-hidden='true'>
        <rect
          x='4.5'
          y='8.5'
          width='31'
          height='23'
          rx='2.5'
          stroke='currentColor'
          strokeWidth='1.6'
        />
        <circle cx='14' cy='16' r='2.5' stroke='currentColor' strokeWidth='1.6' />
        <path
          d='M6 27l8.5-7.5 6 5 5-4L34 27'
          stroke='currentColor'
          strokeWidth='1.6'
          strokeLinecap='round'
          strokeLinejoin='round'
        />
      </svg>
    </div>
  );
}
