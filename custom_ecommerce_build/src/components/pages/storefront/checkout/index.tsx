'use client';

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
import { DeliveryMethod } from '@/generated/prisma/enums';

import {
  checkoutInitialValues,
  checkoutValidationSchema,
  type ICheckoutFormValues,
} from './types';

type Zone = { id: string; name: string; feeKobo: number };

const DELIVERY_OPTIONS = [
  { label: 'Deliver to my address', value: DeliveryMethod.ZONE_DELIVERY },
  { label: 'Pick up in store (free)', value: DeliveryMethod.PICKUP },
];

/** Live order summary. Indicative only — the server re-prices everything. */
function OrderSummary({ zones }: { zones: Zone[] }) {
  const { values } = useFormikContext<ICheckoutFormValues>();
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
        <div className='flex justify-between border-t pt-2 font-medium'>
          <dt>Total</dt>
          <dd>{formatCurrency(subtotalKobo + deliveryFeeKobo)}</dd>
        </div>
      </dl>
      {values.couponCode ? (
        <p className='mt-3 text-xs text-gray-500'>
          Any discount is applied and confirmed on the payment step.
        </p>
      ) : null}
    </div>
  );
}

export default function CheckoutView({ zones }: { zones: Zone[] }) {
  const items = useCart((s) => s.items);
  const clearCart = useCart((s) => s.clear);
  const router = useRouter();
  const [paymentError, setPaymentError] = useState<string | null>(null);

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

              <InputField
                name='couponCode'
                label='Coupon code'
                placeholder='Optional'
              />
            </div>

            <div className='space-y-4'>
              <OrderSummary zones={zones} />

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
