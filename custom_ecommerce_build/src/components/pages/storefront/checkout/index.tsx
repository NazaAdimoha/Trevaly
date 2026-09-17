'use client';

import { isAxiosError } from 'axios';
import { Form, Formik, type FormikHelpers, useFormikContext } from 'formik';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { api, extractErrorMessage } from '@/lib/api';
import { resumePaystackTransaction } from '@/lib/payments/paystack-popup';
import { useCart } from '@/lib/store/cart';
import { formatCurrency } from '@/lib/utils';

import { InputField } from '@/components/fields/InputField';
import { SelectField } from '@/components/fields/SelectField';
import { TextAreaField } from '@/components/fields/TextAreaField';

import { STOREFRONT_ROUTES } from '@/constant/routes';
import { DeliveryMethod } from '@core/enums';

import {
  checkoutInitialValues,
  checkoutValidationSchema,
  type ICheckoutFormValues,
} from './types';

type Zone = { id: string; name: string; feeKobo: number };

/** A coupon the server has quoted for this cart. Indicative, like the summary. */
type AppliedCoupon = { code: string; discountKobo: number };

const normalizeCode = (code: string) => code.trim().toUpperCase();

/**
 * The quote only counts while the field still holds the code it was issued
 * for. Derived rather than cleared in an effect: editing the field is enough to
 * withdraw the discount, with no moment where a stale one is still displayed.
 */
function activeCoupon(
  applied: AppliedCoupon | null,
  fieldValue: string,
): AppliedCoupon | null {
  return applied && applied.code === normalizeCode(fieldValue) ? applied : null;
}

const DELIVERY_OPTIONS = [
  { label: 'Deliver to my address', value: DeliveryMethod.ZONE_DELIVERY },
  { label: 'Pick up in store (free)', value: DeliveryMethod.PICKUP },
];

/** Live order summary. Indicative only — the server re-prices everything. */
function OrderSummary({
  zones,
  applied,
}: {
  zones: Zone[];
  applied: AppliedCoupon | null;
}) {
  const { values } = useFormikContext<ICheckoutFormValues>();
  const coupon = activeCoupon(applied, values.couponCode);
  const discountKobo = coupon?.discountKobo ?? 0;
  const items = useCart((s) => s.items);

  const subtotalKobo = items.reduce(
    (total, item) => total + item.unitPriceKobo * item.quantity,
    0,
  );

  const zone =
    values.deliveryMethod === DeliveryMethod.ZONE_DELIVERY
      ? zones.find((z) => z.id === values.deliveryZoneId)
      : undefined;
  const deliveryFeeKobo = zone?.feeKobo ?? 0;

  return (
    <div className='rounded-lg border p-4 text-sm'>
      <p className='font-medium'>Order summary</p>
      <dl className='mt-3 space-y-2'>
        <div className='flex justify-between'>
          <dt className='text-gray-600'>Subtotal</dt>
          <dd>{formatCurrency(subtotalKobo)}</dd>
        </div>
        <div className='flex justify-between'>
          <dt className='text-gray-600'>Delivery</dt>
          <dd>
            {values.deliveryMethod === DeliveryMethod.PICKUP
              ? 'Free'
              : zone
                ? formatCurrency(deliveryFeeKobo)
                : '—'}
          </dd>
        </div>
        {coupon ? (
          <div className='flex justify-between text-green-700'>
            <dt>Discount ({coupon.code})</dt>
            <dd>−{formatCurrency(discountKobo)}</dd>
          </div>
        ) : null}
        <div className='flex justify-between border-t pt-2 font-medium'>
          <dt>Total</dt>
          <dd>
            {formatCurrency(
              Math.max(0, subtotalKobo - discountKobo) + deliveryFeeKobo,
            )}
          </dd>
        </div>
      </dl>
      {values.couponCode && !coupon ? (
        <p className='mt-3 text-xs text-gray-500'>
          Apply your code to see the discount before you pay.
        </p>
      ) : null}
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
  const { values } = useFormikContext<ICheckoutFormValues>();
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

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

  return (
    <div>
      <InputField
        name='couponCode'
        label='Coupon code'
        placeholder='Optional'
        autoCapitalize='characters'
        onKeyDown={(e) => {
          // Enter applies the code rather than submitting the whole checkout
          // and opening a payment the shopper did not ask for yet.
          if (e.key === 'Enter') {
            e.preventDefault();
            void apply();
          }
        }}
      />
      <div className='mt-2 flex flex-wrap items-center gap-3'>
        <button
          type='button'
          onClick={() => void apply()}
          disabled={!code || checking || current !== null}
          className='rounded-md border px-4 py-2 text-sm font-medium disabled:opacity-50'
        >
          {checking ? 'Checking…' : current ? 'Applied' : 'Apply'}
        </button>
        {current ? (
          <span className='text-sm text-green-700' role='status'>
            {formatCurrency(current.discountKobo)} off
          </span>
        ) : message ? (
          <span className='text-sm text-red-700' role='alert'>
            {message}
          </span>
        ) : null}
      </div>
    </div>
  );
}

export default function CheckoutView({ zones }: { zones: Zone[] }) {
  const items = useCart((s) => s.items);
  const clearCart = useCart((s) => s.clear);
  const router = useRouter();
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(
    null,
  );

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

  const handleSubmit = async (
    values: ICheckoutFormValues,
    { setSubmitting }: FormikHelpers<ICheckoutFormValues>,
  ) => {
    setPaymentError(null);

    try {
      // The server re-prices the whole cart, creates a PENDING order, and
      // initializes payment. We send ids and quantities only — never a price.
      const { data } = await api.post<{
        reference: string;
        accessCode: string;
      }>('/checkout', {
        items: items.map((item) => ({
          productId: item.productId,
          ...(item.variantId ? { variantId: item.variantId } : {}),
          quantity: item.quantity,
        })),
        customerName: values.customerName.trim(),
        customerEmail: values.customerEmail.trim(),
        customerPhone: values.customerPhone.trim(),
        deliveryMethod: values.deliveryMethod,
        ...(values.deliveryMethod === DeliveryMethod.ZONE_DELIVERY
          ? {
              deliveryZoneId: values.deliveryZoneId,
              deliveryAddress: values.deliveryAddress.trim(),
            }
          : {}),
        ...(values.couponCode.trim()
          ? { couponCode: values.couponCode.trim() }
          : {}),
      });

      // The cart is deliberately NOT cleared here. The order is still PENDING;
      // if the customer abandons the popup they must keep their cart.
      await resumePaystackTransaction(data.accessCode, {
        // Only now is the money actually gone, so only now is it safe to empty
        // the cart and send them on. The confirmation page re-verifies against
        // Paystack, so this navigation asserts nothing about payment by itself.
        onSuccess: () => {
          clearCart();
          router.push(STOREFRONT_ROUTES.order(data.reference));
        },
        // A closed popup is not a failure. The order stays PENDING and the cart
        // stays full so they can simply try again.
        onCancel: () => setSubmitting(false),
        onError: (error) => {
          setPaymentError(
            error?.message ??
              'Payment could not be completed. Please try again.',
          );
          setSubmitting(false);
        },
      });
    } catch (err) {
      // Inline, not a toast — a customer mid-payment will miss a toast, and
      // this is the moment they most need to know what went wrong.
      setPaymentError(extractErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className='mx-auto max-w-3xl px-4 py-10'>
      <h1 className='text-2xl font-semibold'>Checkout</h1>

      <Formik
        initialValues={checkoutInitialValues}
        validationSchema={checkoutValidationSchema}
        onSubmit={handleSubmit}
      >
        {({ isSubmitting, values }) => (
          <Form className='mt-6 grid gap-8 md:grid-cols-[1fr_320px]'>
            <div className='space-y-5'>
              <InputField name='customerName' label='Full name' required />
              <InputField
                name='customerEmail'
                label='Email'
                type='email'
                required
                subtitle='Your receipt and order updates go here.'
              />
              <InputField
                name='customerPhone'
                label='Phone number'
                required
                placeholder='08031234567'
              />

              <SelectField
                name='deliveryMethod'
                label='Delivery'
                required
                options={DELIVERY_OPTIONS}
              />

              {values.deliveryMethod === DeliveryMethod.ZONE_DELIVERY ? (
                <>
                  <SelectField
                    name='deliveryZoneId'
                    label='Delivery zone'
                    required
                    placeholder='Select your area'
                    options={zones.map((zone) => ({
                      label: `${zone.name} — ${formatCurrency(zone.feeKobo)}`,
                      value: zone.id,
                    }))}
                  />
                  <TextAreaField
                    name='deliveryAddress'
                    label='Delivery address'
                    rows={3}
                    required
                  />
                </>
              ) : null}

              <CouponField
                subtotalKobo={subtotalKobo}
                applied={appliedCoupon}
                onApplied={setAppliedCoupon}
              />
            </div>

            <div className='space-y-4'>
              <OrderSummary zones={zones} applied={appliedCoupon} />

              {paymentError ? (
                <p
                  role='alert'
                  className='rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700'
                >
                  {paymentError}
                </p>
              ) : null}

              <button
                type='submit'
                disabled={isSubmitting}
                className='w-full rounded-md px-6 py-3 text-sm font-medium text-white disabled:opacity-60'
                style={{ backgroundColor: 'var(--brand)' }}
              >
                {isSubmitting ? 'Starting payment...' : 'Pay now'}
              </button>

              <p className='text-center text-xs text-gray-500'>
                Payments are processed by Paystack. Your card details never
                reach this store.
              </p>
            </div>
          </Form>
        )}
      </Formik>
    </div>
  );
}
