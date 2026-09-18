'use client';

import { ArrowRight, Lock, Minus, Plus, RotateCcw, Trash2, Truck } from 'lucide-react';
import Link from 'next/link';

import { formatCurrency } from '@core/money';

import { lineKey, useCart } from '@/lib/store/cart';

import { PaymentIcons } from '@/components/Layouts/Storefront/payment-icons';
import { ProductImage } from '@/components/ui/product-image';

import { STOREFRONT_ROUTES } from '@/constant/routes';

/**
 * The cart page.
 *
 * Most shoppers never see it — the drawer handles the common path — so this is
 * the considered view: the one someone opens on a laptop to check a long order
 * before paying, or lands on from a link they sent themselves. It is built to
 * match the drawer control for control, because arriving here from the drawer
 * and finding different buttons is what makes a shop feel assembled from parts.
 */
export default function CartView() {
  const items = useCart((s) => s.items);
  const updateQuantity = useCart((s) => s.updateQuantity);
  const removeItem = useCart((s) => s.removeItem);

  const subtotalKobo = items.reduce(
    (total, item) => total + item.unitPriceKobo * item.quantity,
    0,
  );
  const count = items.reduce((n, item) => n + item.quantity, 0);

  if (items.length === 0) {
    return (
      <div
        className='st-container max-w-lg text-center'
        style={{ paddingBlock: 'var(--st-section-y)' }}
      >
        <h1 className='st-display text-2xl md:text-3xl'>Your cart is empty</h1>
        <p className='st-muted mt-3 text-sm'>
          Nothing here yet — everything you add will wait for you.
        </p>
        <Link href={STOREFRONT_ROUTES.home} className='st-btn st-btn-accent mt-6 inline-flex'>
          Start shopping
        </Link>
      </div>
    );
  }

  return (
    <div className='st-container max-w-5xl' style={{ paddingBlock: 'var(--st-section-y)' }}>
      <h1 className='st-display text-3xl md:text-4xl'>Your cart</h1>
      <p className='st-muted mt-2 text-sm'>
        {count} {count === 1 ? 'item' : 'items'}
      </p>

      <div className='mt-8 grid gap-10 lg:grid-cols-[1fr_340px] lg:gap-14'>
        <ul className='st-hairline list-none divide-y border-t'>
          {items.map((item) => {
            const key = lineKey(item);
            return (
              <li key={key} className='flex gap-4 py-5'>
                {/* `imageUrl` is a Cloudinary PUBLIC ID, not a URL — the cart
                    carries the same value `Product.imageUrls` stores. A bare
                    <img src> asks the browser for it as a relative path, which
                    is why every thumbnail here once rendered broken.
                    `ProductImage` derives the delivery URL, exactly as the grid
                    and the product page do. */}
                <Link
                  href={STOREFRONT_ROUTES.product(item.slug)}
                  className='st-media block size-24 shrink-0 sm:size-28'
                  aria-hidden
                  tabIndex={-1}
                >
                  {item.imageUrl ? (
                    <ProductImage src={item.imageUrl} alt='' sizes='112px' />
                  ) : null}
                </Link>

                <div className='flex min-w-0 flex-1 flex-col'>
                  <div className='flex items-start justify-between gap-4'>
                    <div className='min-w-0'>
                      <Link
                        href={STOREFRONT_ROUTES.product(item.slug)}
                        className='text-sm font-medium transition-opacity hover:opacity-70'
                      >
                        {item.name}
                      </Link>
                      {item.variantLabel ? (
                        <p className='st-muted mt-0.5 text-xs'>{item.variantLabel}</p>
                      ) : null}
                      <p className='st-muted mt-1 text-xs tabular-nums'>
                        {formatCurrency(item.unitPriceKobo)} each
                      </p>
                    </div>

                    <p className='shrink-0 text-sm font-medium tabular-nums'>
                      {formatCurrency(item.unitPriceKobo * item.quantity)}
                    </p>
                  </div>

                  <div className='mt-auto flex items-center justify-between gap-3 pt-4'>
                    {/* The same stepper as the drawer, not a number input. A
                        spinner on a phone opens a keypad to change a 1 into a
                        2, and its arrows are smaller than a fingertip. */}
                    <div
                      className='st-control flex items-center'
                      style={{ border: '1px solid var(--st-line)' }}
                    >
                      <button
                        type='button'
                        onClick={() => updateQuantity(key, item.quantity - 1)}
                        disabled={item.quantity <= 1}
                        aria-label={`Reduce quantity of ${item.name}`}
                        className='px-3 py-2 disabled:opacity-40'
                      >
                        <Minus className='size-3.5' />
                      </button>
                      <span className='min-w-7 text-center text-sm tabular-nums'>
                        {item.quantity}
                      </span>
                      <button
                        type='button'
                        onClick={() => updateQuantity(key, item.quantity + 1)}
                        disabled={item.quantity >= item.maxStock}
                        aria-label={`Increase quantity of ${item.name}`}
                        className='px-3 py-2 disabled:opacity-40'
                      >
                        <Plus className='size-3.5' />
                      </button>
                    </div>

                    <button
                      type='button'
                      onClick={() => removeItem(key)}
                      aria-label={`Remove ${item.name}${item.variantLabel ? `, ${item.variantLabel}` : ''}`}
                      className='st-muted flex items-center gap-1.5 text-xs transition-opacity hover:opacity-70'
                    >
                      <Trash2 className='size-3.5' aria-hidden />
                      Remove
                    </button>
                  </div>

                  {item.quantity >= item.maxStock ? (
                    <p className='mt-2 text-xs' style={{ color: 'var(--st-sale)' }}>
                      That is all {item.name} we have left.
                    </p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>

        {/* Sticky on a laptop so the total and the button stay in reach of a
            long cart; on a phone it simply follows the list. */}
        <aside className='lg:sticky lg:top-24 lg:self-start'>
          <div
            className='px-5 py-5'
            style={{
              background: 'var(--st-surface)',
              borderRadius: 'var(--st-radius-card)',
            }}
          >
            <div className='flex items-baseline justify-between gap-4'>
              <span className='st-display text-base'>Subtotal</span>
              <span className='st-display text-xl tabular-nums'>
                {formatCurrency(subtotalKobo)}
              </span>
            </div>
            <p className='st-muted mt-2 text-xs'>
              Delivery and any discount are calculated at checkout.
            </p>

            <Link
              href={STOREFRONT_ROUTES.checkout}
              className='st-btn st-btn-accent mt-5 flex w-full items-center justify-center gap-2 py-4'
            >
              Checkout
              <ArrowRight className='size-4' aria-hidden />
            </Link>

            <Link
              href={STOREFRONT_ROUTES.home}
              className='st-muted mt-3 block text-center text-xs hover:opacity-70'
            >
              Continue shopping
            </Link>
          </div>

          {/* The same three reassurances as the product page, in the same
              order, so they read as the shop's policy rather than as copy
              written twice. */}
          <ul className='mt-6 space-y-3 text-xs'>
            <li className='flex items-center gap-3'>
              <Truck className='st-muted size-4 shrink-0' aria-hidden />
              Delivered nationwide, usually within two to four days
            </li>
            <li className='flex items-center gap-3'>
              <RotateCcw className='st-muted size-4 shrink-0' aria-hidden />
              Message us within seven days if something is not right
            </li>
            <li className='flex items-center gap-3'>
              <Lock className='st-muted size-4 shrink-0' aria-hidden />
              Card, transfer or USSD — payments handled by Paystack
            </li>
          </ul>

          <div className='mt-5 flex justify-center'>
            <PaymentIcons />
          </div>
        </aside>
      </div>
    </div>
  );
}
