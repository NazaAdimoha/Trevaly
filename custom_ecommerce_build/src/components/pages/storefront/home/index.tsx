import Link from 'next/link';

import {
  displayPriceKobo,
  hasPriceRange,
  isSoldOut,
  type VariantLike,
} from '@core/variants';

import { formatCurrency } from '@/lib/utils';

import { ProductImage } from '@/components/ui/product-image';

import { STOREFRONT_ROUTES } from '@/constant/routes';
import { themeConfig } from '@/constant/storefront-themes';
import type { StorefrontTheme } from '@/generated/prisma/enums';

type ProductCard = {
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
 * Every visual difference between themes here comes from the `st-*` classes and
 * their custom properties — the markup is identical on all three, which is what
 * keeps this one component rather than three. The two things the theme decides
 * in TypeScript are the ones CSS cannot: whether a SKU is shown, and the
 * `sizes` hint, which must track the theme's column counts or every image is
 * fetched at the wrong resolution.
 *
 * A Server Component, and it must stay one. The theme and store name arrive as
 * props rather than from `useTenant()` for that reason alone: reading the
 * client context here would force `'use client'` onto the catalogue, shipping
 * JavaScript for a page that is pure markup and is the page search engines
 * actually index.
 */
export default function ProductGrid({
  products,
  theme: themeName,
  storeName,
  emptyMessage,
}: {
  products: ProductCard[];
  theme: StorefrontTheme;
  storeName: string;
  /** Overrides the day-one copy when the grid is filtered to a category. */
  emptyMessage?: string;
}) {
  const theme = themeConfig(themeName);

  if (products.length === 0) {
    return (
      <div className='mx-auto max-w-6xl px-4 py-24 text-center'>
        <p className='text-base font-medium text-gray-900'>
          Nothing here just yet
        </p>
        <p className='mx-auto mt-2 max-w-sm text-sm text-gray-500'>
          {emptyMessage ??
            `${storeName} is still adding products. Check back shortly — or message us and we will tell you what is coming.`}
        </p>
      </div>
    );
  }

  return (
    <div className='st-section mx-auto max-w-6xl px-4'>
      <ul className='st-grid list-none p-0'>
        {products.map((product) => {
          const [cover] = product.imageUrls;
          // Availability comes from the variants when there are any: selling
          // the last size 42 must not mark size 40 sold out.
          const soldOut = isSoldOut(product);
          const fromPrice = hasPriceRange(product);

          return (
            <li key={product.id}>
              <Link
                href={STOREFRONT_ROUTES.product(product.slug)}
                className='st-card group h-full'
              >
                <div className='st-media'>
                  {cover ? (
                    <ProductImage
                      src={cover}
                      alt={product.name}
                      sizes={theme.gridImageSizes}
                      className='object-cover transition duration-300 group-hover:scale-[1.04]'
                    />
                  ) : (
                    <ImagePlaceholder />
                  )}
                  {soldOut ? (
                    <span className='absolute top-2 left-2 rounded-[3px] bg-black/75 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-white uppercase'>
                      Sold out
                    </span>
                  ) : null}
                </div>

                <h2 className='st-product-name text-gray-900'>
                  {product.name}
                </h2>

                {theme.showSku && product.sku ? (
                  <p className='mt-0.5 font-mono text-[11px] text-gray-400'>
                    {product.sku}
                  </p>
                ) : null}

                <p className='st-product-price mt-1'>
                  {fromPrice ? (
                    <span className='mr-1 text-[0.85em] font-normal opacity-70'>
                      From
                    </span>
                  ) : null}
                  {formatCurrency(displayPriceKobo(product))}
                </p>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * A designed empty state rather than a grey square. Tenants launch with
 * unphotographed products routinely, and a blank tile reads as a broken page.
 */
function ImagePlaceholder() {
  return (
    <div className='absolute inset-0 flex items-center justify-center'>
      <svg
        width='40'
        height='40'
        viewBox='0 0 40 40'
        fill='none'
        aria-hidden='true'
        className='text-gray-300'
      >
        <rect
          x='4.5'
          y='8.5'
          width='31'
          height='23'
          rx='2.5'
          stroke='currentColor'
          strokeWidth='1.6'
        />
        <circle
          cx='14'
          cy='16'
          r='2.5'
          stroke='currentColor'
          strokeWidth='1.6'
        />
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
