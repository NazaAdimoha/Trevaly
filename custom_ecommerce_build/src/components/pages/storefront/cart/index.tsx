'use client';

import { Trash2 } from 'lucide-react';
import Link from 'next/link';

import { lineKey, useCart } from '@/lib/store/cart';
import { formatCurrency } from '@/lib/utils';

import { ProductImage } from '@/components/ui/product-image';

import { STOREFRONT_ROUTES } from '@/constant/routes';

export default function CartView() {
  const items = useCart((s) => s.items);
  const updateQuantity = useCart((s) => s.updateQuantity);
  const removeItem = useCart((s) => s.removeItem);

  const subtotalKobo = items.reduce(
    (total, item) => total + item.unitPriceKobo * item.quantity,
    0,
  );

  if (items.length === 0) {
    return (
      <div className='mx-auto max-w-2xl px-4 py-24 text-center'>
        <h1 className='text-xl font-semibold'>Your cart is empty</h1>
        <Link
          href={STOREFRONT_ROUTES.home}
          className='mt-4 inline-block text-sm underline'
        >
          Continue shopping
        </Link>
      </div>
    );
  }

  return (
    <div className='mx-auto max-w-3xl px-4 py-10'>
      <h1 className='text-2xl font-semibold'>Your cart</h1>

      <ul className='mt-6 divide-y'>
        {items.map((item) => (
          <li key={lineKey(item)} className='flex items-center gap-4 py-4'>
            {/* `imageUrl` is a Cloudinary PUBLIC ID, not a URL — the cart
                carries the same value `Product.imageUrls` stores. A bare
                <img src> asks the browser for it as a relative path, which is
                why every thumbnail here rendered broken. `ProductImage` derives
                the delivery URL, exactly as the grid and product page do. */}
            <div className='relative size-16 shrink-0 overflow-hidden rounded bg-gray-100'>
              {item.imageUrl ? (
                <ProductImage
                  src={item.imageUrl}
                  alt={item.name}
                  sizes='64px'
                  className='object-cover'
                />
              ) : null}
            </div>

            <div className='min-w-0 flex-1'>
              <Link
                href={STOREFRONT_ROUTES.product(item.slug)}
                className='truncate text-sm font-medium hover:underline'
              >
                {item.name}
              </Link>
              {item.variantLabel ? (
                <p className='text-xs text-gray-500'>{item.variantLabel}</p>
              ) : null}
              <p className='text-sm text-gray-600'>
                {formatCurrency(item.unitPriceKobo)}
              </p>
            </div>

            <input
              type='number'
              min={1}
              max={item.maxStock}
              value={item.quantity}
              aria-label={`Quantity for ${item.name}`}
              onChange={(e) =>
                updateQuantity(lineKey(item), Number(e.target.value) || 0)
              }
              className='w-16 rounded-md border px-2 py-1 text-sm'
            />

            <p className='w-24 text-right text-sm font-medium'>
              {formatCurrency(item.unitPriceKobo * item.quantity)}
            </p>

            <button
              type='button'
              onClick={() => removeItem(lineKey(item))}
              aria-label={`Remove ${item.name}${item.variantLabel ? `, ${item.variantLabel}` : ''}`}
              className='text-gray-400 hover:text-red-600'
            >
              <Trash2 className='size-4' />
            </button>
          </li>
        ))}
      </ul>

      <div className='mt-6 flex items-center justify-between border-t pt-6'>
        <span className='text-sm text-gray-600'>Subtotal</span>
        <span className='text-lg font-semibold'>
          {formatCurrency(subtotalKobo)}
        </span>
      </div>
      <p className='mt-1 text-right text-xs text-gray-500'>
        Delivery and any discount are calculated at checkout.
      </p>

      <Link
        href={STOREFRONT_ROUTES.checkout}
        className='mt-6 block rounded-md px-6 py-3 text-center text-sm font-medium text-white'
        style={{ backgroundColor: 'var(--brand)' }}
      >
        Checkout
      </Link>
    </div>
  );
}
