'use client';

import { Lock, Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import Link from 'next/link';

import { cloudinaryUrl } from '@core/media/folder';

import { type CartItem, lineKey, useCart } from '@/lib/store/cart';
import { useIsOpen, useStorefrontUi } from '@/lib/store/ui';
import { formatCurrency } from '@/lib/utils';

import { STOREFRONT_ROUTES } from '@/constant/routes';

import { Drawer } from './drawer';

/**
 * The cart, as a panel over the page the shopper is already on.
 *
 * The full-page cart it replaces cost a navigation in both directions: a
 * shopper who added a second item lost their place in the catalogue to check
 * it. Keeping them on the page is the single change most likely to move
 * conversion, which is why every reference theme does it.
 *
 * `/cart` still exists and still works — it is a real URL people bookmark and
 * paste, and it is where a shopper lands with JavaScript disabled.
 */
export function CartDrawer({
  freeShippingThresholdKobo,
  suggestions,
}: {
  freeShippingThresholdKobo?: number | null;
  /** Shown when the cart is empty — somewhere to go, rather than a dead end. */
  suggestions?: { name: string; slug: string; imageUrl: string | null }[];
}) {
  const open = useIsOpen('cart');
  const close = useStorefrontUi((s) => s.close);
  const items = useCart((s) => s.items);
  const subtotal = useCart((s) => s.subtotalKobo());

  const count = items.reduce((total, item) => total + item.quantity, 0);

  return (
    <Drawer
      open={open}
      onClose={close}
      title={count > 0 ? `Cart (${count})` : 'Cart'}
      className='sm:max-w-md'
      footer={
        items.length > 0 ? (
          <div className='space-y-3'>
            <div className='flex items-baseline justify-between'>
              <span className='st-muted text-sm'>Subtotal</span>
              <span className='st-display text-lg tabular-nums'>
                {formatCurrency(subtotal)}
              </span>
            </div>
            <p className='st-muted text-xs'>
              Delivery and any discount are worked out at checkout.
            </p>
            <Link
              href={STOREFRONT_ROUTES.checkout}
              onClick={close}
              className='st-btn st-btn-accent w-full'
            >
              <Lock className='size-4' />
              Checkout
            </Link>
            <Link
              href={STOREFRONT_ROUTES.cart}
              onClick={close}
              className='st-muted block text-center text-sm underline underline-offset-4'
            >
              View full cart
            </Link>
          </div>
        ) : null
      }
    >
      {freeShippingThresholdKobo && items.length > 0 ? (
        <FreeShippingProgress subtotal={subtotal} threshold={freeShippingThresholdKobo} />
      ) : null}

      {items.length === 0 ? (
        <EmptyCart suggestions={suggestions} onNavigate={close} />
      ) : (
        <ul className='divide-y' style={{ borderColor: 'var(--st-line)' }}>
          {items.map((item) => (
            <CartLine key={lineKey(item)} item={item} />
          ))}
        </ul>
      )}
    </Drawer>
  );
}

/**
 * How far from free delivery.
 *
 * Shown as a bar rather than a sentence alone because the number that matters
 * is the gap, and a shopper reads a bar faster than they read money. The
 * threshold is the merchant's, from their announcement settings, so the promise
 * on the bar and the promise at the top of the page cannot disagree.
 */
function FreeShippingProgress({
  subtotal,
  threshold,
}: {
  subtotal: number;
  threshold: number;
}) {
  const remaining = Math.max(0, threshold - subtotal);
  const percent = Math.min(100, Math.round((subtotal / threshold) * 100));

  return (
    <div className='st-hairline border-b px-5 py-4'>
      <p className='text-sm'>
        {remaining === 0 ? (
          <span className='font-medium'>You have earned free delivery.</span>
        ) : (
          <>
            You are <span className='font-medium'>{formatCurrency(remaining)}</span> away
            from free delivery.
          </>
        )}
      </p>
      <div
        className='mt-2 h-1.5 w-full overflow-hidden rounded-full'
        style={{ background: 'var(--st-line)' }}
        role='progressbar'
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label='Progress towards free delivery'
      >
        <div
          className='h-full rounded-full transition-[width] duration-500'
          style={{ width: `${percent}%`, background: 'var(--st-accent)' }}
        />
      </div>
    </div>
  );
}

function CartLine({ item }: { item: CartItem }) {
  const updateQuantity = useCart((s) => s.updateQuantity);
  const removeItem = useCart((s) => s.removeItem);
  const key = lineKey(item);

  const image = item.imageUrl
    ? cloudinaryUrl(process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME, item.imageUrl, {
        width: 160,
        height: 160,
        crop: 'fill',
      })
    : null;

  return (
    <li className='flex gap-4 px-5 py-4'>
      <Link
        href={STOREFRONT_ROUTES.product(item.slug)}
        className='st-media size-20 shrink-0'
        aria-hidden
        tabIndex={-1}
      >
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element -- already a sized Cloudinary delivery URL
          <img src={image} alt='' className='size-full object-cover' loading='lazy' />
        ) : null}
      </Link>

      <div className='min-w-0 flex-1'>
        <div className='flex items-start justify-between gap-2'>
          <Link href={STOREFRONT_ROUTES.product(item.slug)} className='text-sm font-medium'>
            {item.name}
          </Link>
          <button
            type='button'
            onClick={() => removeItem(key)}
            aria-label={`Remove ${item.name}`}
            className='st-muted -m-1 p-1 transition-opacity hover:opacity-60'
          >
            <Trash2 className='size-4' />
          </button>
        </div>

        {item.variantLabel ? (
          <p className='st-muted mt-0.5 text-xs'>{item.variantLabel}</p>
        ) : null}

        <div className='mt-3 flex items-center justify-between gap-3'>
          <div
            className='st-control flex items-center'
            style={{ border: '1px solid var(--st-line)' }}
          >
            <button
              type='button'
              onClick={() => updateQuantity(key, item.quantity - 1)}
              aria-label='Reduce quantity'
              className='px-2.5 py-1.5 disabled:opacity-40'
              disabled={item.quantity <= 1}
            >
              <Minus className='size-3.5' />
            </button>
            <span className='min-w-6 text-center text-sm tabular-nums'>{item.quantity}</span>
            <button
              type='button'
              onClick={() => updateQuantity(key, item.quantity + 1)}
              aria-label='Increase quantity'
              className='px-2.5 py-1.5 disabled:opacity-40'
              disabled={item.quantity >= item.maxStock}
            >
              <Plus className='size-3.5' />
            </button>
          </div>

          <span className='text-sm tabular-nums'>
            {formatCurrency(item.unitPriceKobo * item.quantity)}
          </span>
        </div>

        {item.quantity >= item.maxStock ? (
          <p className='st-muted mt-1.5 text-xs'>
            That is all we have of this one.
          </p>
        ) : null}
      </div>
    </li>
  );
}

function EmptyCart({
  suggestions,
  onNavigate,
}: {
  suggestions?: { name: string; slug: string; imageUrl: string | null }[];
  onNavigate: () => void;
}) {
  return (
    <div className='px-5 py-10 text-center'>
      <ShoppingBag className='st-muted mx-auto size-8' />
      <p className='st-display mt-4 text-lg'>Your cart is empty</p>

      {suggestions && suggestions.length > 0 ? (
        <>
          <p className='st-muted mt-1 text-sm'>Were you looking for one of these?</p>
          <ul className='mt-6 grid grid-cols-3 gap-3 text-left'>
            {suggestions.slice(0, 3).map((item) => {
              const image = item.imageUrl
                ? cloudinaryUrl(
                    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
                    item.imageUrl,
                    { width: 240, height: 300, crop: 'fill' },
                  )
                : null;
              return (
                <li key={item.slug}>
                  <Link
                    href={STOREFRONT_ROUTES.product(item.slug)}
                    onClick={onNavigate}
                    className='block'
                  >
                    <span className='st-media block aspect-[4/5]'>
                      {image ? (
                        // eslint-disable-next-line @next/next/no-img-element -- sized Cloudinary delivery URL
                        <img
                          src={image}
                          alt=''
                          className='size-full object-cover'
                          loading='lazy'
                        />
                      ) : null}
                    </span>
                    <span className='mt-2 block text-xs'>{item.name}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      ) : (
        <p className='st-muted mt-1 text-sm'>Add something and it will show up here.</p>
      )}

      <Link
        href={STOREFRONT_ROUTES.home}
        onClick={onNavigate}
        className='st-btn st-btn-outline mt-8 w-full'
      >
        Continue shopping
      </Link>
    </div>
  );
}
