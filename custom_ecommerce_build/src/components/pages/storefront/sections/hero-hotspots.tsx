'use client';

import Link from 'next/link';
import { useState } from 'react';

import { formatCurrency } from '@core/money';
import { displayPriceKobo, isSoldOut } from '@core/variants';

import { useCart } from '@/lib/store/cart';
import { useStorefrontUi } from '@/lib/store/ui';

import type { StorefrontProductCard } from '@/components/pages/storefront/home';

import { STOREFRONT_ROUTES } from '@/constant/routes';

type Hotspot = { x: number; y: number; product: StorefrontProductCard };

/**
 * Dots on the hero that name what is in the photograph.
 *
 * This is the one thing in the reference themes that a catalogue grid cannot
 * do: a shopper sees an outfit, not five products, and a hotspot is how the
 * outfit becomes buyable without making them guess which listing is the boot.
 *
 * Each dot is a real button with the product's name as its accessible label, so
 * the picture is navigable by keyboard and readable by a screen reader — a
 * cluster of unlabelled dots would be neither.
 *
 * Products that sell by option are LINKS to the product page rather than
 * add-to-cart: we cannot pick someone's size for them.
 */
export function HeroHotspots({
  hotspots,
  addAllLabel,
}: {
  hotspots: Hotspot[];
  addAllLabel: string | null;
}) {
  const [active, setActive] = useState<number | null>(null);
  const addItem = useCart((s) => s.addItem);
  const openCart = useStorefrontUi((s) => s.open);

  const simple = hotspots.filter(
    ({ product }) => product.variants.length === 0 && !isSoldOut(product),
  );

  const addAll = () => {
    for (const { product } of simple) {
      addItem({
        productId: product.id,
        variantId: null,
        variantLabel: null,
        name: product.name,
        slug: product.slug,
        imageUrl: product.imageUrls[0] ?? null,
        unitPriceKobo: displayPriceKobo(product),
        maxStock: product.stock,
      });
    }
    openCart('cart');
  };

  return (
    <>
      {hotspots.map((spot, index) => {
        const open = active === index;
        return (
          <div
            key={`${spot.product.id}-${index}`}
            className='absolute z-10'
            style={{ left: `${spot.x}%`, top: `${spot.y}%` }}
          >
            <button
              type='button'
              onClick={() => setActive(open ? null : index)}
              aria-expanded={open}
              aria-label={`Show ${spot.product.name}`}
              className='st-hotspot relative flex size-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-white/30 backdrop-blur'
            >
              <span className='size-2.5 rounded-full bg-white' />
            </button>

            {open ? (
              <div
                className='absolute top-1/2 left-6 flex w-max max-w-[60vw] -translate-y-1/2 items-center gap-3 p-2 shadow-lg'
                style={{
                  background: 'var(--st-bg)',
                  color: 'var(--st-ink)',
                  borderRadius: 'var(--st-radius-card)',
                }}
              >
                <Link
                  href={STOREFRONT_ROUTES.product(spot.product.slug)}
                  className='text-sm font-medium'
                >
                  {spot.product.name}
                </Link>
                <span className='st-muted text-sm tabular-nums'>
                  {formatCurrency(displayPriceKobo(spot.product))}
                </span>
              </div>
            ) : null}
          </div>
        );
      })}

      {addAllLabel && simple.length > 0 ? (
        <div className='absolute right-4 bottom-4 z-10'>
          <button type='button' onClick={addAll} className='st-btn st-btn-accent'>
            {addAllLabel}
          </button>
        </div>
      ) : null}
    </>
  );
}
