'use client';

import { isAxiosError } from 'axios';
import { useFormikContext } from 'formik';
import { Check, ChevronDown, Lock, Tag } from 'lucide-react';
import { useId, useState } from 'react';

import { DeliveryMethod } from '@core/enums';
import { formatCurrency } from '@core/money';

import { api } from '@/lib/api';
import { lineKey, useCart } from '@/lib/store/cart';

import { PaymentIcons } from '@/components/Layouts/Storefront/payment-icons';
import { ProductImage } from '@/components/ui/product-image';

import type { ICheckoutFormValues } from './types';

export type Zone = { id: string; name: string; feeKobo: number };

/** A coupon the server has quoted for this cart. Indicative, like the summary. */
export type AppliedCoupon = { code: string; discountKobo: number };

export const normalizeCode = (code: string) => code.trim().toUpperCase();

/**
 * The quote only counts while the field still holds the code it was issued
 * for. Derived rather than cleared in an effect: editing the field is enough to
 * withdraw the discount, with no moment where a stale one is still displayed.
 */
export function activeCoupon(
  applied: AppliedCoupon | null,
  fieldValue: string,
): AppliedCoupon | null {
  return applied && applied.code === normalizeCode(fieldValue) ? applied : null;
}

/**
 * The order summary: what is being bought, and what it costs.
 *
 * It shows the ITEMS, not only the arithmetic. The old summary was four numbers
 * in a box, which asks a shopper to trust that the cart they filled ten minutes
 * ago is still the cart they are paying for — and the one moment they most want
 * to check is with their card in hand.
 *
 * On a phone it collapses into a `<details>` pinned above the form, so the
 * total is visible before any typing and the summary does not push the first
 * field below the fold. The browser owns the disclosure; we ship no JavaScript
 * for it.
 */
export function OrderSummary({
  zones,
  applied,
  onApplied,
  collapsible,
}: {
  zones: Zone[];
  applied: AppliedCoupon | null;
  onApplied: (coupon: AppliedCoupon | null) => void;
  /** Phone layout: a disclosure. Desktop: always open, in the right column. */
  collapsible?: boolean;
}) {
  const { values } = useFormikContext<ICheckoutFormValues>();
  const items = useCart((s) => s.items);

  const coupon = activeCoupon(applied, values.couponCode);
  const discountKobo = coupon?.discountKobo ?? 0;

  const subtotalKobo = items.reduce(
    (total, item) => total + item.unitPriceKobo * item.quantity,
    0,
  );
  const zone =
    values.deliveryMethod === DeliveryMethod.ZONE_DELIVERY
      ? zones.find((z) => z.id === values.deliveryZoneId)
      : undefined;
  const deliveryFeeKobo = zone?.feeKobo ?? 0;
  const totalKobo = Math.max(0, subtotalKobo - discountKobo) + deliveryFeeKobo;
  const count = items.reduce((n, item) => n + item.quantity, 0);

  const body = (
    <>
      <ul className='st-hairline list-none divide-y border-y'>
        {items.map((item) => (
          <li key={lineKey(item)} className='flex items-center gap-3 py-3'>
            {/* The badge sits on a wrapper, not inside `st-media` — that class
                clips its overflow to round the image corners, which would take
                the corner off the count too. */}
            <div className='relative size-14 shrink-0'>
              <div className='st-media size-14'>
                {item.imageUrl ? (
                  <ProductImage src={item.imageUrl} alt='' sizes='56px' />
                ) : null}
              </div>
              {/* The count rides on the thumbnail, the way every checkout a
                  shopper has already used puts it. */}
              <span
                className='absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full text-[10px] font-semibold'
                style={{ background: 'var(--st-ink)', color: 'var(--st-bg)' }}
              >
                {item.quantity}
              </span>
            </div>
            <div className='min-w-0 flex-1'>
              <p className='truncate text-sm font-medium'>{item.name}</p>
              {item.variantLabel ? (
                <p className='st-muted text-xs'>{item.variantLabel}</p>
              ) : null}
            </div>
            <p className='shrink-0 text-sm tabular-nums'>
              {formatCurrency(item.unitPriceKobo * item.quantity)}
            </p>
          </li>
        ))}
      </ul>

      <CouponField subtotalKobo={subtotalKobo} applied={applied} onApplied={onApplied} />

      <dl className='mt-4 space-y-2 text-sm'>
        <Row label='Subtotal' value={formatCurrency(subtotalKobo)} />
        <Row
          label='Delivery'
          value={
            values.deliveryMethod === DeliveryMethod.PICKUP
              ? 'Free'
              : zone
                ? formatCurrency(deliveryFeeKobo)
                : '—'
          }
          // Until a zone is picked the total is incomplete, and saying so is
          // better than showing a number that is about to change.
          muted={values.deliveryMethod === DeliveryMethod.ZONE_DELIVERY && !zone}
        />
        {coupon ? (
          <Row
            label={`Discount · ${coupon.code}`}
            value={`−${formatCurrency(discountKobo)}`}
            tone='var(--st-success)'
          />
        ) : null}
        <div className='st-hairline flex items-baseline justify-between gap-4 border-t pt-3'>
          <dt className='st-display text-base'>Total</dt>
          <dd className='st-display text-xl tabular-nums'>{formatCurrency(totalKobo)}</dd>
        </div>
      </dl>
    </>
  );

  if (!collapsible) {
    return (
      <div
        className='px-5 py-5'
        style={{ background: 'var(--st-surface)', borderRadius: 'var(--st-radius-card)' }}
      >
        <p className='st-display mb-4 text-sm tracking-[0.18em] uppercase'>
          Order summary
        </p>
        {body}
      </div>
    );
  }

  return (
    <details
      className='st-sort st-hairline border-b lg:hidden'
      style={{ background: 'var(--st-surface)' }}
    >
      <summary className='st-container flex cursor-pointer list-none items-center justify-between py-4'>
        <span className='flex items-center gap-2 text-sm'>
          Order summary
          <span className='st-muted'>
            ({count} {count === 1 ? 'item' : 'items'})
          </span>
          <ChevronDown className='size-4' aria-hidden />
        </span>
        <span className='st-display tabular-nums'>{formatCurrency(totalKobo)}</span>
      </summary>
      <div className='st-container pb-5'>{body}</div>
    </details>
  );
}

function Row({
  label,
  value,
  tone,
  muted,
}: {
  label: string;
  value: string;
  tone?: string;
  muted?: boolean;
}) {
  return (
    <div className='flex justify-between gap-4' style={tone ? { color: tone } : undefined}>
      <dt className={tone ? undefined : 'st-muted'}>{label}</dt>
      <dd className={muted ? 'st-muted tabular-nums' : 'tabular-nums'}>{value}</dd>
    </div>
  );
}

/**
 * Coupon entry with a real quote.
 *
 * `/api/coupons/preview` existed from the start but nothing called it, so a
 * shopper found out what their code was worth only after the Paystack overlay
 * had opened — the worst moment to be surprised by a total. This is its caller.
 *
 * It now lives INSIDE the summary rather than at the bottom of the form, next
 * to the number it changes: a discount field far from the total is a field
 * people apply and then scroll to verify.
 *
 * Still indicative: `/api/checkout` recomputes the discount from the database
 * and ignores anything decided here. A shopper who never presses Apply is
 * checked there instead, with the same uniform message.
 */
function CouponField({
  subtotalKobo,
  applied,
  onApplied,
}: {
  subtotalKobo: number;
  applied: AppliedCoupon | null;
  onApplied: (coupon: AppliedCoupon | null) => void;
}) {
  const { values, setFieldValue } = useFormikContext<ICheckoutFormValues>();
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  // The summary renders TWICE — the phone disclosure and the desktop column
  // are both in the DOM at every width, only one of them displayed. A literal
  // id would therefore be duplicated on every checkout, which silently breaks
  // the label-to-input association for whichever copy the browser matches
  // second, and with it the screen reader and the click-the-label affordance.
  const fieldId = useId();

  const code = normalizeCode(values.couponCode);
  const current = activeCoupon(applied, values.couponCode);

  const apply = async () => {
    if (!code || checking) return;
    setChecking(true);
    setMessage(null);
    try {
      const { data } = await api.post<
        | { valid: true; code: string; discountKobo: number }
        | { valid: false; error: string }
      >('/coupons/preview', { code, subtotalKobo });

      if (data.valid) {
        onApplied({ code: data.code, discountKobo: data.discountKobo });
      } else {
        onApplied(null);
        // The server's wording, verbatim — it is deliberately the same for
        // every kind of failure, and paraphrasing it here could undo that.
        setMessage(data.error);
      }
    } catch (err) {
      onApplied(null);
      setMessage(
        isAxiosError(err) && err.response?.status === 429
          ? 'Too many attempts. Please wait a moment and try again.'
          : 'We could not check that code just now. It will still be checked when you pay.',
      );
    } finally {
      setChecking(false);
    }
  };

  if (current) {
    return (
      <div
        className='mt-4 flex items-center justify-between gap-3 px-3 py-2.5 text-sm'
        style={{
          background: 'var(--st-success-wash)',
          borderRadius: 'var(--st-radius-control)',
        }}
      >
        <span className='flex min-w-0 items-center gap-2' role='status'>
          <Check className='size-4 shrink-0' style={{ color: 'var(--st-success)' }} aria-hidden />
          <span className='truncate font-medium'>{current.code}</span>
          <span className='st-muted shrink-0'>
            −{formatCurrency(current.discountKobo)}
          </span>
        </span>
        <button
          type='button'
          onClick={() => {
            onApplied(null);
            void setFieldValue('couponCode', '');
          }}
          className='st-muted shrink-0 text-xs underline hover:opacity-70'
        >
          Remove
        </button>
      </div>
    );
  }

  return (
    <div className='mt-4'>
      <label htmlFor={fieldId} className='st-muted mb-2 flex items-center gap-2 text-xs'>
        <Tag className='size-3.5' aria-hidden />
        Discount code
      </label>
      <div className='flex gap-2'>
        <input
          id={fieldId}
          name='couponCode'
          value={values.couponCode}
          onChange={(e) => void setFieldValue('couponCode', e.target.value)}
          autoCapitalize='characters'
          placeholder='Optional'
          className='st-control min-w-0 flex-1 px-3 py-2.5 text-sm outline-none'
          style={{ border: '1px solid var(--st-line)', background: 'var(--st-bg)' }}
          onKeyDown={(e) => {
            // Enter applies the code rather than submitting the whole checkout
            // and opening a payment the shopper did not ask for yet.
            if (e.key === 'Enter') {
              e.preventDefault();
              void apply();
            }
          }}
        />
        <button
          type='button'
          onClick={() => void apply()}
          disabled={!code || checking}
          className='st-btn st-btn-outline shrink-0 px-4 py-2.5 text-sm disabled:opacity-50'
        >
          {checking ? 'Checking…' : 'Apply'}
        </button>
      </div>
      {message ? (
        <p className='mt-2 text-xs' role='alert' style={{ color: 'var(--st-sale)' }}>
          {message}
        </p>
      ) : null}
    </div>
  );
}

/** What a shopper looks for before typing a card number. */
export function TrustRow() {
  return (
    <div className='mt-4 text-center'>
      <p className='st-muted flex items-center justify-center gap-2 text-xs'>
        <Lock className='size-3.5' aria-hidden />
        Secured by Paystack. Your card details never reach this store.
      </p>
      <div className='mt-3 flex justify-center'>
        <PaymentIcons />
      </div>
    </div>
  );
}
