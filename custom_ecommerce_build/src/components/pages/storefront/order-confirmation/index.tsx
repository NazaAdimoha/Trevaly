'use client';

import { CheckCircle2, Clock } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

import { maskEmail } from '@core/validation/store-settings';

import { api } from '@/lib/api';
import { useCart } from '@/lib/store/cart';
import { formatCurrency } from '@/lib/utils';

import { STOREFRONT_ROUTES } from '@/constant/routes';

type VerifyState = 'verifying' | 'paid' | 'pending';

/**
 * Landing page after Paystack redirects back.
 *
 * Calls the verify route as a fast path so the customer sees confirmation
 * immediately — but a failure here is NOT a failed payment. The webhook is the
 * trusted path and may land moments later, so an unconfirmed order is reported
 * as "being confirmed", never as failed. Telling someone their payment failed
 * when it succeeded is the worse error.
 */
export default function OrderConfirmationView({
  reference,
  order,
}: {
  reference: string;
  order: {
    orderNumber: number;
    status: string;
    totalKobo: number;
    customerEmail: string;
  } | null;
}) {
  const [state, setState] = useState<VerifyState>(
    order?.status === 'PAID' ? 'paid' : 'verifying',
  );
  const clearCart = useCart((s) => s.clear);
  const attempted = useRef(false);

  useEffect(() => {
    if (state === 'paid') {
      clearCart();
      return;
    }
    if (attempted.current) return;
    attempted.current = true;

    /**
     * Deliberately not guarded by a `cancelled` flag.
     *
     * The obvious shape — set `cancelled` in cleanup and drop the response —
     * is wrong here when combined with the `attempted` guard: Strict Mode
     * unmounts and remounts, so the first response is discarded and the second
     * mount refuses to retry, leaving the page on "Confirming your payment"
     * forever even though the order was verified on the first call. Re-arming
     * `attempted` in cleanup fixes the spinner but sends two concurrent
     * verifies instead, which is worse. Applying the one in-flight result is
     * both correct and harmless — React has not warned about setState after
     * unmount since 18.
     */
    const verify = async () => {
      try {
        const { data } = await api.post<{ status: string }>(
          '/payments/verify',
          {
            reference,
          },
        );

        if (data.status === 'PAID') {
          setState('paid');
          clearCart();
        } else {
          setState('pending');
        }
      } catch {
        // 202 or network failure — the webhook still has the order.
        setState('pending');
      }
    };

    void verify();
  }, [reference, state, clearCart]);

  if (state === 'verifying') {
    return (
      <div className='mx-auto max-w-lg px-4 py-24 text-center'>
        <Clock className='mx-auto size-10 animate-pulse text-gray-400' />
        <h1 className='mt-4 text-xl font-semibold'>Confirming your payment</h1>
        <p className='mt-2 text-sm text-gray-600'>This takes a few seconds.</p>
      </div>
    );
  }

  if (state === 'pending') {
    return (
      <div className='mx-auto max-w-lg px-4 py-24 text-center'>
        <Clock className='mx-auto size-10 text-amber-500' />
        <h1 className='mt-4 text-xl font-semibold'>
          Payment is being confirmed
        </h1>
        <p className='mt-2 text-sm text-gray-600'>
          If your card was charged, your order is safe — we are still confirming
          it with the bank. You will get an email once it clears.
        </p>
        <p className='mt-4 text-xs text-gray-500'>
          Reference: <code>{reference}</code>
        </p>
      </div>
    );
  }

  return (
    <div className='mx-auto max-w-lg px-4 py-24 text-center'>
      <CheckCircle2 className='mx-auto size-10 text-green-600' />
      <h1 className='mt-4 text-xl font-semibold'>
        Thank you — order confirmed
      </h1>

      {order ? (
        <div className='mt-6 rounded-lg border p-4 text-left text-sm'>
          <div className='flex justify-between'>
            <span className='text-gray-600'>Order number</span>
            <span className='font-medium'>#{order.orderNumber}</span>
          </div>
          <div className='mt-2 flex justify-between'>
            <span className='text-gray-600'>Total paid</span>
            <span className='font-medium'>
              {formatCurrency(order.totalKobo)}
            </span>
          </div>
        </div>
      ) : null}

      <p className='mt-4 text-sm text-gray-600'>
        A receipt is on its way to{' '}
        {order ? maskEmail(order.customerEmail) : 'your email'}.
      </p>

      <Link
        href={STOREFRONT_ROUTES.home}
        className='mt-6 inline-block text-sm underline'
      >
        Continue shopping
      </Link>
    </div>
  );
}
