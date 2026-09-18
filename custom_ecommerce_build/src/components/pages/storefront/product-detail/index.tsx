'use client';

import { ChevronRight, Lock, Minus, Plus, RotateCcw, Share2, Truck } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { formatCurrency } from '@core/money';
import {
  activeVariants,
  hasVariants,
  variantLabel,
  type VariantLike,
  variantPriceKobo,
} from '@core/variants';

import { cn } from '@/lib/cn';
import { useCart } from '@/lib/store/cart';
import { useStorefrontUi } from '@/lib/store/ui';

import { PaymentIcons } from '@/components/Layouts/Storefront/payment-icons';

import { STOREFRONT_ROUTES } from '@/constant/routes';

import { ProductGallery } from './gallery';

/** Below this, a shopper is told how few are left. Above it, silence. */
const LOW_STOCK = 10;

export type ProductDetail = {
  id: string;
  name: string;
  slug: string;
  sku: string | null;
  description: string | null;
  priceKobo: number;
  stock: number;
  optionName: string | null;
  imageUrls: string[];
  variants: VariantLike[];
  category?: { name: string; slug: string } | null;
};

/**
 * The product page — where a shopper decides.
 *
 * Everything added here answers a question that otherwise sends someone back to
 * the catalogue or to WhatsApp: what does it look like from the other side
 * (gallery), which size is actually available (the grid, with sold-out options
 * struck through rather than hidden), is it about to run out (urgency, shown
 * only when true), what happens if it does not fit (delivery and returns, next
 * to the button), and what goes with it (pairs well with).
 *
 * The sticky bar appears once the real buy button scrolls away, so the answer
 * to "how do I buy this" is never further than a thumb.
 */
export default function ProductDetailView({ product }: { product: ProductDetail }) {
  const router = useRouter();
  const addItem = useCart((s) => s.addItem);
  const openCart = useStorefrontUi((s) => s.open);
  const [quantity, setQuantity] = useState(1);
  const [copied, setCopied] = useState(false);
  const [showSticky, setShowSticky] = useState(false);
  const buyRef = useRef<HTMLDivElement>(null);
  const optionsRef = useRef<HTMLFieldSetElement>(null);

  const options = activeVariants(product);
  const sellsByVariant = hasVariants(product);

  // Preselect when there is only one live option — making someone click the
  // single available size to enable a button is friction for nothing.
  const [selectedId, setSelectedId] = useState<string | null>(
    options.length === 1 ? (options[0]?.id ?? null) : null,
  );
  const selected = options.find((v) => v.id === selectedId) ?? null;

  const stock = sellsByVariant ? (selected?.stock ?? 0) : product.stock;
  const priceKobo = variantPriceKobo(product, selected);
  const everythingSoldOut = sellsByVariant
    ? options.every((v) => v.stock <= 0)
    : product.stock <= 0;
  const mustChoose = sellsByVariant && !selected;
  const outOfStock = everythingSoldOut || (!mustChoose && stock <= 0);
  const showUrgency = !mustChoose && stock > 0 && stock <= LOW_STOCK;

  useEffect(() => {
    const target = buyRef.current;
    if (!target) return;
    // The bar is the inverse of the button's visibility, so the two are never
    // on screen together.
    const observer = new IntersectionObserver(
      ([entry]) => setShowSticky(!entry?.isIntersecting),
      { rootMargin: '-80px 0px 0px 0px' },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  const handleAdd = (buyNow: boolean) => {
    addItem(
      {
        productId: product.id,
        variantId: selected?.id ?? null,
        variantLabel: selected ? variantLabel(product.optionName, selected.value) : null,
        name: product.name,
        slug: product.slug,
        imageUrl: product.imageUrls[0] ?? null,
        unitPriceKobo: priceKobo,
        maxStock: stock,
      },
      quantity,
    );

    if (buyNow) {
      router.push(STOREFRONT_ROUTES.checkout);
      return;
    }
    // The drawer IS the confirmation: it shows the line just added, the running
    // total and the way to checkout.
    openCart('cart');
  };

  /**
   * What the sticky bar does before a size is picked.
   *
   * Not a disabled button labelled "Choose size": that names the problem and
   * then refuses to help with it, which on a phone means scrolling back up
   * hunting for the control it meant. Tapping it takes the shopper to the sizes
   * and puts focus on the first one they can actually buy.
   */
  const jumpToOptions = () => {
    const fieldset = optionsRef.current;
    if (!fieldset) return;
    fieldset.scrollIntoView({ behavior: 'smooth', block: 'center' });
    fieldset.querySelector<HTMLButtonElement>('button:not([disabled])')?.focus();
  };

  const share = async () => {
    const url = window.location.href;
    // The native sheet where there is one — on a phone that means WhatsApp,
    // which is how these links actually travel.
    if (navigator.share) {
      await navigator.share({ title: product.name, url }).catch(() => undefined);
      return;
    }
    await navigator.clipboard.writeText(url).catch(() => undefined);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <div className='st-container' style={{ paddingBlock: 'var(--st-section-y)' }}>
        <nav aria-label='Breadcrumb' className='st-muted mb-6 flex items-center gap-1 text-xs'>
          <Link href={STOREFRONT_ROUTES.home} className='hover:opacity-70'>
            Home
          </Link>
          {product.category ? (
            <>
              <ChevronRight className='size-3' aria-hidden />
              <Link
                href={STOREFRONT_ROUTES.category(product.category.slug)}
                className='hover:opacity-70'
              >
                {product.category.name}
              </Link>
            </>
          ) : null}
          <ChevronRight className='size-3' aria-hidden />
          <span aria-current='page'>{product.name}</span>
        </nav>

        <div className='grid gap-8 md:grid-cols-2 md:gap-12'>
          <ProductGallery images={product.imageUrls} alt={product.name} />

          <div>
            <h1 className='st-display text-2xl md:text-4xl'>{product.name}</h1>

            <p className='mt-3 text-xl tabular-nums'>{formatCurrency(priceKobo)}</p>
            <p className='st-muted mt-1 text-xs'>
              Tax included. Delivery calculated at checkout.
            </p>

            {sellsByVariant ? (
              <fieldset ref={optionsRef} className='mt-8'>
                <legend className='st-display mb-3 text-sm'>
                  {product.optionName ?? 'Option'}
                  {selected ? (
                    <span className='st-muted ml-2 font-normal'>{selected.value}</span>
                  ) : null}
                </legend>

                <div className='flex flex-wrap gap-2'>
                  {options.map((option) => {
                    const soldOut = option.stock <= 0;
                    const active = option.id === selectedId;
                    return (
                      <button
                        key={option.id}
                        type='button'
                        onClick={() => setSelectedId(option.id)}
                        disabled={soldOut}
                        aria-pressed={active}
                        className={cn(
                          'st-control min-w-12 px-4 py-2.5 text-sm transition-colors',
                          // Sold-out options stay visible and struck through: a
                          // shopper needs to know the size exists and is gone,
                          // not wonder whether the store stocks it at all.
                          soldOut && 'line-through opacity-40',
                        )}
                        style={{
                          border: '1px solid var(--st-line)',
                          ...(active
                            ? { background: 'var(--st-ink)', color: 'var(--st-bg)' }
                            : {}),
                        }}
                      >
                        {option.value}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            ) : null}

            {showUrgency ? (
              <p className='mt-5 text-sm font-medium' style={{ color: 'var(--st-sale)' }}>
                Only {stock} left
              </p>
            ) : null}

            <div ref={buyRef} className='mt-6 flex flex-col gap-3 sm:flex-row sm:items-stretch'>
              <div
                className='st-control flex items-center justify-between sm:w-32'
                style={{ border: '1px solid var(--st-line)' }}
              >
                <button
                  type='button'
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  disabled={quantity <= 1}
                  aria-label='Reduce quantity'
                  className='px-3 py-3 disabled:opacity-40'
                >
                  <Minus className='size-4' />
                </button>
                <span className='text-sm tabular-nums'>{quantity}</span>
                <button
                  type='button'
                  onClick={() => setQuantity((q) => Math.min(stock || 1, q + 1))}
                  disabled={quantity >= stock}
                  aria-label='Increase quantity'
                  className='px-3 py-3 disabled:opacity-40'
                >
                  <Plus className='size-4' />
                </button>
              </div>

              <button
                type='button'
                disabled={outOfStock || mustChoose}
                onClick={() => handleAdd(false)}
                className='st-btn st-btn-outline flex-1 disabled:opacity-50'
              >
                {outOfStock ? 'Sold out' : 'Add to cart'}
              </button>
            </div>

            <button
              type='button'
              disabled={outOfStock || mustChoose}
              onClick={() => handleAdd(true)}
              className='st-btn st-btn-accent mt-3 w-full disabled:opacity-50'
            >
              Buy it now
            </button>

            {mustChoose && !everythingSoldOut ? (
              <p className='st-muted mt-3 text-sm'>
                Pick a {(product.optionName ?? 'option').toLowerCase()} to continue.
              </p>
            ) : null}

            {/* The three questions asked after "does it fit": how it arrives,
                what happens if it is wrong, and whether paying is safe. */}
            <ul className='st-hairline mt-8 space-y-3 border-t pt-6 text-sm'>
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

            <div className='mt-6 flex flex-wrap items-center justify-between gap-4'>
              <PaymentIcons />
              <button
                type='button'
                onClick={share}
                className='st-muted flex items-center gap-2 text-sm hover:opacity-70'
              >
                <Share2 className='size-4' />
                {copied ? 'Link copied' : 'Share'}
              </button>
            </div>

            {product.description ? (
              <details open className='st-faq st-hairline mt-8 border-t py-4'>
                <summary className='st-display flex cursor-pointer list-none items-center justify-between text-sm'>
                  Description
                  <span aria-hidden className='st-muted text-xl group-open:rotate-45'>
                    +
                  </span>
                </summary>
                <p className='st-muted mt-3 text-sm leading-relaxed whitespace-pre-line'>
                  {product.description}
                </p>
              </details>
            ) : null}

            {product.sku ? (
              <p className='st-muted mt-4 font-mono text-xs'>SKU {product.sku}</p>
            ) : null}
          </div>
        </div>
      </div>

      {/* Sticky buy bar. Hidden until the real button leaves the screen, so it
          never duplicates a control the shopper can already see. */}
      {showSticky && !outOfStock ? (
        <div
          role='region'
          aria-label='Quick buy'
          className='st-hairline fixed inset-x-0 bottom-0 z-30 border-t lg:bottom-0'
          style={{
            background: 'color-mix(in srgb, var(--st-bg) 95%, transparent)',
            backdropFilter: 'blur(10px)',
            paddingBottom: 'env(safe-area-inset-bottom)',
          }}
        >
          <div className='st-container flex items-center gap-4 py-3'>
            <div className='min-w-0 flex-1'>
              <p className='truncate text-sm font-medium'>{product.name}</p>
              <p className='st-muted text-sm tabular-nums'>
                {formatCurrency(priceKobo)}
                {selected ? ` · ${selected.value}` : ''}
              </p>
            </div>
            <button
              type='button'
              onClick={mustChoose ? jumpToOptions : () => handleAdd(false)}
              className='st-btn st-btn-accent shrink-0'
            >
              {mustChoose
                ? `Choose ${(product.optionName ?? 'option').toLowerCase()}`
                : 'Add to cart'}
            </button>
          </div>
        </div>
      ) : null}

      {/* Room for the bar plus the mobile tab bar underneath it. */}
      {showSticky ? <div className='h-20' aria-hidden /> : null}
    </>
  );
}
