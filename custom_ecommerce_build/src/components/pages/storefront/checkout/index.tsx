'use client';

import { Form, Formik, type FormikHelpers } from 'formik';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { DeliveryMethod } from '@core/enums';
import { formatCurrency } from '@core/money';

import { api, extractErrorMessage } from '@/lib/api';
import { resumePaystackTransaction } from '@/lib/payments/paystack-popup';
import { useCart } from '@/lib/store/cart';
import { useTenant } from '@/lib/tenant-context';

import { STOREFRONT_ROUTES } from '@/constant/routes';

import { AreaField, ChoiceField, PickField, TextField } from './fields';
import {
  type AppliedCoupon,
  OrderSummary,
  TrustRow,
  type Zone,
} from './summary';
import {
  checkoutInitialValues,
  checkoutValidationSchema,
  type ICheckoutFormValues,
} from './types';

/**
 * Checkout.
 *
 * The page where a shopper who has already decided still walks away, and — until
 * this pass — the only one in the storefront that used none of the store's
 * design tokens. A shopper went from a shop with the merchant's typeface,
 * colour and shapes to a grey form, and then back to a designed confirmation.
 * The one step handling their money looked the least like it belonged.
 *
 * Three things changed beyond the paint:
 *
 *  - the summary shows the ITEMS, not four numbers, and on a phone it collapses
 *    above the form so the total is visible before any typing;
 *  - the delivery choice is two cards rather than a dropdown, because it
 *    changes both the rest of the form and the total;
 *  - every field carries `autoComplete`, which is what lets a phone fill the
 *    whole contact block in one tap.
 */
export default function CheckoutView({
  zones,
  storeAddress,
}: {
  zones: Zone[];
  /**
   * Passed from the server page rather than read from `useTenant()`. The
   * storefront's client tenant context deliberately carries branding only —
   * this is already public (it is in the store's structured data), but the
   * context is kept minimal on purpose and one checkout string is not a reason
   * to widen it for every page.
   */
  storeAddress: string | null;
}) {
  const items = useCart((s) => s.items);
  const clearCart = useCart((s) => s.clear);
  const tenant = useTenant();
  const router = useRouter();
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);

  if (items.length === 0) return <EmptyCart />;

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
            error?.message ?? 'Payment could not be completed. Please try again.',
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
    <Formik
      initialValues={checkoutInitialValues}
      validationSchema={checkoutValidationSchema}
      onSubmit={handleSubmit}
    >
      {({ isSubmitting, values }) => (
        <Form>
          {/* Phone: the summary sits above everything, collapsed. */}
          <OrderSummary
            zones={zones}
            applied={appliedCoupon}
            onApplied={setAppliedCoupon}
            collapsible
          />

          <div
            className='st-container max-w-5xl'
            style={{ paddingBlock: 'var(--st-section-y)' }}
          >
            <Link
              href={STOREFRONT_ROUTES.cart}
              className='st-muted mb-6 inline-flex items-center gap-2 text-xs hover:opacity-70'
            >
              <ArrowLeft className='size-3.5' aria-hidden />
              Back to cart
            </Link>

            <h1 className='st-display text-3xl md:text-4xl'>Checkout</h1>

            <div className='mt-8 grid gap-10 lg:grid-cols-[1fr_380px] lg:gap-14'>
              <div className='space-y-10'>
                <Section index={1} title='Your details'>
                  <TextField
                    name='customerName'
                    label='Full name'
                    autoComplete='name'
                    placeholder='Chidi Okonkwo'
                  />
                  <TextField
                    name='customerEmail'
                    label='Email'
                    type='email'
                    inputMode='email'
                    autoComplete='email'
                    placeholder='you@example.com'
                    hint='Your receipt and order updates go here.'
                  />
                  <TextField
                    name='customerPhone'
                    label='Phone number'
                    type='tel'
                    inputMode='tel'
                    autoComplete='tel'
                    placeholder='08031234567'
                    hint={`How ${tenant.name} reaches you about this delivery.`}
                  />
                </Section>

                <Section index={2} title='Delivery'>
                  <ChoiceField
                    name='deliveryMethod'
                    label='How would you like to get it?'
                    options={[
                      {
                        label: 'Deliver to my address',
                        value: DeliveryMethod.ZONE_DELIVERY,
                        note: 'Fee depends on your area',
                      },
                      {
                        label: 'Pick up in store',
                        value: DeliveryMethod.PICKUP,
                        note: 'Free',
                      },
                    ]}
                  />

                  {values.deliveryMethod === DeliveryMethod.ZONE_DELIVERY ? (
                    <>
                      <PickField
                        name='deliveryZoneId'
                        label='Delivery area'
                        placeholder='Select your area'
                        options={zones.map((zone) => ({
                          label: `${zone.name} — ${formatCurrency(zone.feeKobo)}`,
                          value: zone.id,
                        }))}
                      />
                      <AreaField
                        name='deliveryAddress'
                        label='Delivery address'
                        autoComplete='street-address'
                        placeholder='Street, building, landmark'
                        hint='A landmark helps — most riders ask for one.'
                      />
                    </>
                  ) : (
                    <p className='st-muted text-sm'>
                      {storeAddress
                        ? `Collect from ${storeAddress}.`
                        : `${tenant.name} will confirm the pickup address with you.`}
                    </p>
                  )}
                </Section>
              </div>

              {/* Desktop: the summary follows the shopper down the form, so the
                  total and the pay button are never scrolled away from. */}
              <aside className='hidden lg:block'>
                <div className='sticky top-24 space-y-4'>
                  <OrderSummary
                    zones={zones}
                    applied={appliedCoupon}
                    onApplied={setAppliedCoupon}
                  />
                  {paymentError ? <PaymentError message={paymentError} /> : null}
                  <PayButton pending={isSubmitting} />
                  <TrustRow />
                </div>
              </aside>

              {/* Phone: the button belongs at the end of the form, after the
                  last field, rather than floating over it. */}
              <div className='lg:hidden'>
                {paymentError ? <PaymentError message={paymentError} /> : null}
                <PayButton pending={isSubmitting} />
                <TrustRow />
              </div>
            </div>
          </div>
        </Form>
      )}
    </Formik>
  );
}

/** A numbered block. The numerals say how much is left, before any scrolling. */
function Section({
  index,
  title,
  children,
}: {
  index: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className='st-display mb-5 flex items-center gap-3 text-lg'>
        <span
          className='flex size-7 shrink-0 items-center justify-center rounded-full text-xs'
          style={{ background: 'var(--st-ink)', color: 'var(--st-bg)' }}
        >
          {index}
        </span>
        {title}
      </h2>
      <div className='space-y-5'>{children}</div>
    </section>
  );
}

function PayButton({ pending }: { pending: boolean }) {
  return (
    <button
      type='submit'
      disabled={pending}
      className='st-btn st-btn-accent w-full py-4 disabled:opacity-60'
    >
      {pending ? 'Starting payment…' : 'Pay now'}
    </button>
  );
}

function PaymentError({ message }: { message: string }) {
  return (
    <p
      role='alert'
      className='p-3 text-sm'
      style={{
        border: '1px solid var(--st-sale)',
        color: 'var(--st-sale)',
        borderRadius: 'var(--st-radius-control)',
      }}
    >
      {message}
    </p>
  );
}

function EmptyCart() {
  return (
    <div
      className='st-container max-w-lg text-center'
      style={{ paddingBlock: 'var(--st-section-y)' }}
    >
      <h1 className='st-display text-2xl'>Your cart is empty</h1>
      <p className='st-muted mt-3 text-sm'>
        There is nothing to pay for yet.
      </p>
      <Link href={STOREFRONT_ROUTES.home} className='st-btn st-btn-accent mt-6 inline-flex'>
        Continue shopping
      </Link>
    </div>
  );
}
