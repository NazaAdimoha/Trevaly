'use client';

import {
  ArrowRight,
  Check,
  Info,
  Loader2,
  Mail,
  MessageCircle,
  Package,
  Truck,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

import { formatCurrency } from '@core/money';

import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useCart } from '@/lib/store/cart';
import { useTenant } from '@/lib/tenant-context';

import { ProductImage } from '@/components/ui/product-image';

import { STOREFRONT_ROUTES } from '@/constant/routes';

import { Confetti, CountUpAmount, SuccessMark } from './celebration';

/**
 * `received` — the payment went through, but for an order the store had already
 * closed. It is recorded and flagged for the store, which will send the order or
 * refund. Before this state existed the page fell into `pending` ("being
 * confirmed… you will get an email once it clears"), a promise nothing would
 * ever keep.
 */
type VerifyState = 'verifying' | 'paid' | 'pending' | 'received';

export type ConfirmedOrder = {
  orderNumber: number;
  status: string;
  createdAt: string;
  /** For the greeting. The API sends the first name only. */
  firstName: string;
  /** Masked by the API, e.g. `a•••i@gmail.com`. The full address never reaches this page. */
  maskedEmail: string;
  deliveryMethod: string;
  deliveryFeeKobo: number;
  /** The zone, never the street address — see the API's note on this endpoint. */
  deliveryZoneName: string | null;
  subtotalKobo: number;
  discountKobo: number;
  totalKobo: number;
  paidAfterCancellation: boolean;
  items: {
    id: string;
    productName: string;
    variantLabel: string | null;
    quantity: number;
    unitPriceKobo: number;
    productSlug: string;
    imageUrl: string | null;
  }[];
};

/**
 * Landing page after Paystack redirects back.
 *
 * Calls the verify route as a fast path so the customer sees confirmation
 * immediately — but a failure here is NOT a failed payment. The webhook is the
 * trusted path and may land moments later, so an unconfirmed order is reported
 * as "being confirmed", never as failed. Telling someone their payment failed
 * when it succeeded is the worse error.
 *
 * What the page SHOWS is a separate decision from how it verifies. A shopper
 * who has just sent money to a shop they found on Instagram is at the most
 * anxious moment of the whole transaction, and the old page answered almost
 * none of what they want to know: what did I actually buy, where is it going,
 * what happens now, and how do I reach a human. It is also the last page of the
 * session, so it is the only chance to turn one purchase into a second visit.
 */
export default function OrderConfirmationView({
  reference,
  order,
}: {
  reference: string;
  order: ConfirmedOrder | null;
}) {
  const [state, setState] = useState<VerifyState>(
    order?.status === 'PAID'
      ? 'paid'
      : order?.paidAfterCancellation
        ? 'received'
        : 'verifying',
  );
  const clearCart = useCart((s) => s.clear);
  const attempted = useRef(false);

  useEffect(() => {
    // The money has gone either way, so the cart has served its purpose.
    if (state === 'paid' || state === 'received') {
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
        const { data } = await api.post<{
          status: string;
          paidAfterCancellation?: boolean;
        }>('/payments/verify', { reference });

        if (data.status === 'PAID') {
          setState('paid');
          clearCart();
        } else if (data.paidAfterCancellation) {
          setState('received');
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

  if (state === 'verifying') return <VerifyingState />;
  if (state === 'received') return <ReceivedState reference={reference} />;
  if (state === 'pending') return <PendingState reference={reference} />;
  return <PaidState order={order} />;
}

/* ─── The confirmed order ──────────────────────────────────────────────────── */

function PaidState({ order }: { order: ConfirmedOrder | null }) {
  const tenant = useTenant();
  const contact = contactLink(tenant, order?.orderNumber);

  return (
    <div className='relative overflow-hidden'>
      <Confetti />

      <div
        className='st-container relative max-w-2xl'
        style={{ paddingBlock: 'var(--st-section-y)' }}
      >
        {/* Each block enters a beat after the one above it, so the page
            assembles itself in reading order rather than arriving at once. */}
        <div className='st-enter text-center' style={{ '--st-index': 0 } as never}>
          <SuccessMark />

          <h1 className='st-display mt-6 text-3xl md:text-4xl'>
            {order?.firstName ? `Thank you, ${order.firstName}` : 'Thank you'}
          </h1>
          <p className='st-muted mt-3 text-sm'>
            Your payment is in and {tenant.name} has your order.
          </p>
        </div>

        {order ? (
          <>
            {/* The headline figure, on its own, because it is the number the
                shopper most wants confirmed against their bank alert. */}
            <div
              className='st-enter mt-10 px-6 py-8 text-center'
              style={
                {
                  '--st-index': 1,
                  background: 'var(--st-surface)',
                  borderRadius: 'var(--st-radius-card)',
                } as never
              }
            >
              <p className='st-muted text-xs tracking-[0.18em] uppercase'>Total paid</p>
              <p className='st-display mt-2 text-4xl md:text-5xl'>
                <CountUpAmount kobo={order.totalKobo} />
              </p>
              <p className='st-muted mt-3 text-sm'>
                Order #{order.orderNumber} ·{' '}
                {new Date(order.createdAt).toLocaleDateString(undefined, {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </p>
            </div>

            <Timeline index={2} />

            <Receipt order={order} index={3} />

            <div
              className='st-enter st-hairline mt-8 border-t pt-6'
              style={{ '--st-index': 4 } as never}
            >
              <p className='st-muted text-sm'>
                A receipt is on its way to <strong>{order.maskedEmail}</strong>. Keep
                order #{order.orderNumber} to hand if you need to ask about it.
              </p>
            </div>
          </>
        ) : null}

        {/* Two exits: a human, and the shop. The WhatsApp link is first because
            it is how these merchants actually talk to their customers, and
            because "can I add one more thing" is the most common next message. */}
        <div
          className='st-enter mt-8 flex flex-col gap-3 sm:flex-row'
          style={{ '--st-index': 5 } as never}
        >
          {contact ? (
            <a
              href={contact.href}
              {...(contact.external
                ? { target: '_blank', rel: 'noopener noreferrer' }
                : {})}
              className='st-btn st-btn-outline flex flex-1 items-center justify-center gap-2'
            >
              <contact.icon className='size-4' aria-hidden />
              {contact.label} {tenant.name}
            </a>
          ) : null}

          <Link
            href={STOREFRONT_ROUTES.home}
            className='st-btn st-btn-accent flex flex-1 items-center justify-center gap-2 transition-transform hover:-translate-y-0.5'
          >
            Continue shopping
            <ArrowRight className='size-4' aria-hidden />
          </Link>
        </div>
      </div>
    </div>
  );
}

/**
 * What happens next.
 *
 * Only the first step has actually happened, and the component says so rather
 * than implying live tracking we do not have. It is here because "I have paid,
 * now what?" is the question the old page left entirely unanswered — and an
 * unanswered question at this moment turns into a WhatsApp message the merchant
 * has to answer by hand.
 */
function Timeline({ index }: { index: number }) {
  const steps = [
    { icon: Check, label: 'Payment confirmed', done: true },
    { icon: Package, label: 'Packed by the store', done: false },
    { icon: Truck, label: 'On its way to you', done: false },
  ];

  return (
    <ol
      // No gap: the rails are drawn inside each item, so any space between
      // items would show as a break in the middle of the line.
      className='st-enter mt-10 flex list-none items-start'
      style={{ '--st-index': index } as never}
    >
      {steps.map((step, position) => (
        <li key={step.label} className='flex flex-1 flex-col items-center text-center'>
          <div className='flex w-full items-center'>
            {/* The rails are drawn either side of the dot rather than between
                list items, so the row stays even when a label wraps. */}
            <Rail lit={step.done && position > 0} hidden={position === 0} />
            <span
              className={cn(
                'flex size-9 shrink-0 items-center justify-center rounded-full transition-colors',
              )}
              style={
                step.done
                  ? { background: 'var(--st-success)', color: 'var(--st-bg)' }
                  : {
                      border: '1px solid var(--st-line)',
                      color: 'var(--st-ink-muted)',
                    }
              }
            >
              <step.icon className='size-4' aria-hidden />
            </span>
            <Rail lit={false} hidden={position === steps.length - 1} />
          </div>
          <span
            className={cn('mt-2 text-xs', !step.done && 'st-muted')}
            aria-current={step.done ? 'step' : undefined}
          >
            {step.label}
          </span>
        </li>
      ))}
    </ol>
  );
}

function Rail({ lit, hidden }: { lit: boolean; hidden: boolean }) {
  return (
    <span
      aria-hidden
      className='h-px flex-1'
      style={{
        background: hidden
          ? 'transparent'
          : lit
            ? 'var(--st-success)'
            : 'var(--st-line)',
      }}
    />
  );
}

/** The lines, then the arithmetic. What a paper receipt would show. */
function Receipt({ order, index }: { order: ConfirmedOrder; index: number }) {
  const rows: [string, string][] = [
    ['Subtotal', formatCurrency(order.subtotalKobo)],
    ...(order.discountKobo > 0
      ? ([['Discount', `−${formatCurrency(order.discountKobo)}`]] as [string, string][])
      : []),
    [
      order.deliveryZoneName ? `Delivery · ${order.deliveryZoneName}` : 'Delivery',
      order.deliveryFeeKobo > 0 ? formatCurrency(order.deliveryFeeKobo) : 'Free',
    ],
  ];

  return (
    <section className='st-enter mt-10' style={{ '--st-index': index } as never}>
      <h2 className='st-display mb-4 text-sm tracking-[0.18em] uppercase'>
        Your order
      </h2>

      <ul className='st-hairline list-none divide-y border-y'>
        {order.items.map((item) => (
          <li key={item.id} className='flex items-center gap-4 py-4'>
            <Link
              href={STOREFRONT_ROUTES.product(item.productSlug)}
              className='st-media block size-16 shrink-0'
              aria-hidden
              tabIndex={-1}
            >
              {item.imageUrl ? (
                <ProductImage src={item.imageUrl} alt='' sizes='64px' />
              ) : null}
            </Link>

            <div className='min-w-0 flex-1'>
              <Link
                href={STOREFRONT_ROUTES.product(item.productSlug)}
                className='text-sm font-medium transition-opacity hover:opacity-70'
              >
                {item.productName}
              </Link>
              <p className='st-muted mt-0.5 text-xs'>
                {item.variantLabel ? `${item.variantLabel} · ` : ''}
                {/* The arithmetic, not just the quantity: a receipt whose line
                    total cannot be checked against its unit price is a number
                    the customer has to take on trust. */}
                {formatCurrency(item.unitPriceKobo)} × {item.quantity}
              </p>
            </div>

            <p className='shrink-0 text-sm tabular-nums'>
              {formatCurrency(item.unitPriceKobo * item.quantity)}
            </p>
          </li>
        ))}
      </ul>

      <dl className='mt-4 space-y-2 text-sm'>
        {rows.map(([label, value]) => (
          <div key={label} className='flex justify-between gap-4'>
            <dt className='st-muted'>{label}</dt>
            <dd className='tabular-nums'>{value}</dd>
          </div>
        ))}
        <div className='st-hairline flex justify-between gap-4 border-t pt-2 font-medium'>
          <dt>Total</dt>
          <dd className='tabular-nums'>{formatCurrency(order.totalKobo)}</dd>
        </div>
      </dl>
    </section>
  );
}

/* ─── The other three states ───────────────────────────────────────────────── */

/**
 * The shared frame for every state that is not a confirmed order.
 *
 * On tokens like the rest, rather than the grey-on-white it used to be: a
 * shopper who has just paid and lands on a page that looks nothing like the
 * shop they paid has every reason to think something went wrong.
 */
function StatusFrame({
  tone,
  icon,
  title,
  children,
}: {
  tone: 'neutral' | 'warn' | 'info';
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  const colour =
    tone === 'warn'
      ? 'var(--st-sale)'
      : tone === 'info'
        ? 'var(--st-accent)'
        : 'var(--st-ink-muted)';

  return (
    <div
      className='st-container max-w-lg text-center'
      style={{ paddingBlock: 'var(--st-section-y)' }}
    >
      <div className='st-enter' style={{ '--st-index': 0 } as never}>
        <span
          className='mx-auto flex size-16 items-center justify-center rounded-full'
          style={{ background: 'var(--st-surface)', color: colour }}
        >
          {icon}
        </span>
        <h1 className='st-display mt-6 text-2xl md:text-3xl'>{title}</h1>
      </div>
      <div className='st-enter' style={{ '--st-index': 1 } as never}>
        {children}
      </div>
    </div>
  );
}

function VerifyingState() {
  return (
    <StatusFrame
      tone='neutral'
      icon={<Loader2 className='size-7 animate-spin' aria-hidden />}
      title='Confirming your payment'
    >
      <p className='st-muted mt-3 text-sm'>
        This takes a few seconds. Please do not close this page.
      </p>
    </StatusFrame>
  );
}

function PendingState({ reference }: { reference: string }) {
  const tenant = useTenant();

  return (
    <StatusFrame
      tone='warn'
      icon={<Loader2 className='size-7 animate-spin' aria-hidden />}
      title='Payment is being confirmed'
    >
      <p className='st-muted mt-3 text-sm leading-relaxed'>
        If your card was charged, your order is safe — we are still confirming it
        with the bank. You will get an email once it clears.
      </p>
      <Reference value={reference} />

      {/* This state used to be a dead end: a worrying message, a reference, and
          no way to do anything about either. Someone who thinks their money
          may have vanished needs a person to ask, not a page to stare at. */}
      <Actions
        contact={contactLink(tenant, undefined, reference)}
        tenantName={tenant.name}
        primary='contact'
      />
    </StatusFrame>
  );
}

function ReceivedState({ reference }: { reference: string }) {
  const tenant = useTenant();
  const contact = contactLink(tenant, undefined, reference);

  return (
    <StatusFrame
      tone='info'
      icon={<Info className='size-7' aria-hidden />}
      title='Your payment went through'
    >
      {/* Says the money arrived first, then what happens next. The one thing
          this must never read as is a failed payment — it was not one. */}
      <p className='st-muted mt-3 text-sm leading-relaxed'>
        This order had already been closed by the store when your payment
        arrived, so it has not been dispatched. {tenant.name} can see your
        payment and will either send your order or refund you. If you would like
        to speak to them sooner, quote the reference below.
      </p>
      <Reference value={reference} />

      <Actions contact={contact} tenantName={tenant.name} primary='contact' />
    </StatusFrame>
  );
}

/**
 * Reach a human, or go back to the shop.
 *
 * `primary` decides which of the two gets the accent: on a confirmed order the
 * shop is the useful next step, and on anything unresolved it is the merchant.
 */
function Actions({
  contact,
  tenantName,
  primary,
}: {
  contact: ReturnType<typeof contactLink>;
  tenantName: string;
  primary: 'contact' | 'shop';
}) {
  return (
    <div className='mt-8 flex flex-col gap-3 sm:flex-row'>
      {contact ? (
        <a
          href={contact.href}
          {...(contact.external
            ? { target: '_blank', rel: 'noopener noreferrer' }
            : {})}
          className={cn(
            'st-btn flex flex-1 items-center justify-center gap-2',
            primary === 'contact' ? 'st-btn-accent' : 'st-btn-outline',
          )}
        >
          <contact.icon className='size-4' aria-hidden />
          {contact.label} {tenantName}
        </a>
      ) : null}
      <Link
        href={STOREFRONT_ROUTES.home}
        className={cn(
          'st-btn flex flex-1 items-center justify-center gap-2',
          primary === 'shop' ? 'st-btn-accent' : 'st-btn-outline',
        )}
      >
        Back to the store
      </Link>
    </div>
  );
}

/**
 * How to reach a human, in the order these merchants actually answer.
 *
 * WhatsApp first: it is where this whole market's commerce already happens, and
 * it opens with the order number already typed so the merchant does not have to
 * ask for it. Email is the fallback, because a confirmation page that offers no
 * way to reach anyone is the page that generates a chargeback instead of a
 * message. A store with neither gets no button rather than a dead one.
 */
function contactLink(
  tenant: { name: string; whatsappNumber: string | null; contactEmail: string | null },
  orderNumber?: number,
  reference?: string,
) {
  const about = orderNumber
    ? `order #${orderNumber}`
    : reference
      ? `reference ${reference}`
      : 'my order';

  const whatsapp = tenant.whatsappNumber?.replace(/\D/g, '');
  if (whatsapp) {
    return {
      href: `https://wa.me/${whatsapp}?text=${encodeURIComponent(`Hi! I am writing about ${about}.`)}`,
      label: 'Message',
      icon: MessageCircle,
      external: true,
    };
  }

  if (tenant.contactEmail) {
    return {
      href: `mailto:${tenant.contactEmail}?subject=${encodeURIComponent(
        `About ${about}`,
      )}`,
      label: 'Email',
      icon: Mail,
      external: false,
    };
  }

  return null;
}

/**
 * The payment reference, in a state where the customer may have to read it out.
 *
 * `break-all` because these are long and a phone will otherwise push the page
 * sideways — a horizontal scrollbar on a page about someone's money reads as
 * broken.
 */
function Reference({ value }: { value: string }) {
  return (
    <p
      className='st-muted mt-6 font-mono text-xs break-all'
      style={{
        background: 'var(--st-surface)',
        borderRadius: 'var(--st-radius-control)',
        padding: '0.75rem 1rem',
      }}
    >
      {value}
    </p>
  );
}
