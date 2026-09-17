'use client';

import { AlertTriangle, CreditCard, RotateCcw, ShieldAlert } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { toast } from 'sonner';
import useSWR from 'swr';

import { DeliveryMethod, OrderStatus } from '@core/enums';
import { nextStatuses, ORDER_ACTION_LABEL } from '@core/orders';

import { api, apiFetcher, handleApiError } from '@/lib/api';
import { cn, DATE_FORMATS, formatCurrency, formatDate } from '@/lib/utils';

import Button from '@/components/buttons/Button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import PageHeader from '@/components/ui/pageHeader';

import ROUTES from '@/constant/routes';

import { ORDER_STATUS_BADGE } from '../constants';

type OrderDetail = {
  id: string;
  orderNumber: number;
  status: OrderStatus;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  deliveryMethod: DeliveryMethod;
  deliveryAddress: string | null;
  deliveryFeeKobo: number;
  subtotalKobo: number;
  discountKobo: number;
  totalKobo: number;
  paidAmountKobo: number | null;
  paymentVerifiedAt: string | null;
  hasStockIssue: boolean;
  paidAfterCancellation: boolean;
  internalNote: string | null;
  paymentFailedAt: string | null;
  paymentFailureReason: string | null;
  refundedAmountKobo: number;
  disputedAt: string | null;
  disputeStatus: string | null;
  disputeReason: string | null;
  createdAt: string;
  deliveryZone: { name: string } | null;
  coupon: { code: string } | null;
  items: {
    id: string;
    productName: string;
    variantLabel: string | null;
    quantity: number;
    unitPriceKobo: number;
  }[];
};

/**
 * What a status change does NOT do, said before the merchant commits.
 *
 * These transitions are bookkeeping. None of them moves money, and a merchant
 * who believes "Mark refunded" sent a customer their ₦40,000 back is the most
 * expensive misunderstanding this screen could create.
 */
function consequenceOf(from: OrderStatus, to: OrderStatus): string | null {
  if (to === OrderStatus.REFUNDED) {
    return 'This records the refund here. It does not send any money back — issue the refund from your Paystack dashboard. A refund issued there updates this order on its own.';
  }
  if (to === OrderStatus.CANCELLED && from === OrderStatus.PENDING) {
    return 'The customer has not paid yet. If they complete payment after you cancel, the money still reaches your bank — the payment is recorded and this order is flagged for you to send or refund.';
  }
  if (to === OrderStatus.CANCELLED) {
    return 'Cancelling does not refund the customer. They have paid — issue the refund from your Paystack dashboard.';
  }
  return null;
}

const DESTRUCTIVE: OrderStatus[] = [OrderStatus.CANCELLED, OrderStatus.REFUNDED];

/**
 * One order, and what the merchant can do about it.
 *
 * The actions come from `nextStatuses` in core — the same table the API
 * enforces and the mobile app renders from — so this page cannot offer a button
 * the server will then refuse.
 */
export default function OrderDetailView({
  storeSlug,
  orderId,
}: {
  storeSlug: string;
  orderId: string;
}) {
  const { data: order, isLoading, error, mutate } = useSWR<OrderDetail>(
    `/stores/${storeSlug}/orders/${orderId}`,
    apiFetcher,
  );

  const [pending, setPending] = useState<OrderStatus | null>(null);
  const [saving, setSaving] = useState(false);

  const patch = async (body: Record<string, unknown>, success: string) => {
    setSaving(true);
    try {
      await api.patch(`/stores/${storeSlug}/orders/${orderId}`, body);
      toast.success(success);
      await mutate();
    } catch (err) {
      handleApiError(err);
    } finally {
      setSaving(false);
    }
  };

  const confirmTransition = async () => {
    if (!pending) return;
    const to = pending;
    await patch({ status: to }, `Order #${order?.orderNumber} updated`);
    setPending(null);
  };

  const back = ROUTES.store.orders.base(storeSlug);

  if (isLoading) {
    return <p className='p-6 text-sm text-gray-500'>Loading order…</p>;
  }
  if (error || !order) {
    return (
      <div className='space-y-3'>
        <PageHeader title='Order not found' url={back} />
        <p className='text-sm text-gray-600'>
          This order does not exist, or it belongs to a different store.
        </p>
      </div>
    );
  }

  const badge = ORDER_STATUS_BADGE[order.status];
  const actions = nextStatuses(order.status);

  return (
    <div className='flex flex-col space-y-4'>
      <div className='flex flex-wrap items-start justify-between gap-3'>
        <PageHeader
          title={`Order #${order.orderNumber}`}
          description={`Placed ${formatDate(order.createdAt, DATE_FORMATS.DISPLAY_LONG)}`}
          url={back}
        />
        <span
          className={cn(
            'rounded-full px-3 py-1 text-sm font-medium',
            badge.className,
          )}
        >
          {badge.label}
        </span>
      </div>

      {/* ── Things that need a human, most urgent first ─────────────────── */}
      {order.disputedAt ? (
        <Banner
          tone='danger'
          icon={<ShieldAlert className='size-5' />}
          title={
            order.disputeStatus === 'resolved'
              ? 'Chargeback resolved'
              : 'The customer has raised a chargeback'
          }
        >
          {order.disputeReason ?? 'The customer disputed this payment.'}{' '}
          {order.disputeStatus !== 'resolved'
            ? 'Respond from your Paystack dashboard before the deadline.'
            : null}
        </Banner>
      ) : null}

      {order.paidAfterCancellation ? (
        <Banner
          tone='danger'
          icon={<CreditCard className='size-5' />}
          title='Paid after this order was cancelled'
          action={
            <Button
              size='s'
              variant='outline'
              isLoading={saving}
              onClick={() =>
                void patch({ paidAfterCancellation: false }, 'Marked as resolved')
              }
            >
              Mark resolved
            </Button>
          }
        >
          Paystack captured{' '}
          {order.paidAmountKobo !== null
            ? formatCurrency(order.paidAmountKobo)
            : 'the payment'}{' '}
          and settled it to your bank, but the order had already been
          cancelled — nothing was fulfilled and no stock was taken. Send the
          order and adjust stock, or refund the customer from your Paystack
          dashboard. A full refund clears this on its own.
        </Banner>
      ) : null}

      {order.hasStockIssue ? (
        <Banner
          tone='warning'
          icon={<AlertTriangle className='size-5' />}
          title='Paid, but stock ran out before it could be packed'
          action={
            <Button
              size='s'
              variant='outline'
              isLoading={saving}
              onClick={() =>
                void patch({ hasStockIssue: false }, 'Marked as resolved')
              }
            >
              Mark resolved
            </Button>
          }
        >
          The customer&apos;s money is real. Send a replacement, or refund them
          from your Paystack dashboard.
        </Banner>
      ) : null}

      {order.refundedAmountKobo > 0 ? (
        <Banner
          tone='warning'
          icon={<RotateCcw className='size-5' />}
          title={
            order.status === OrderStatus.REFUNDED ? 'Refunded' : 'Partly refunded'
          }
        >
          {formatCurrency(order.refundedAmountKobo)} returned to the customer.
          Stock was not added back — adjust it if the item came back to you.
        </Banner>
      ) : null}

      {order.paymentFailedAt && order.status === OrderStatus.PENDING ? (
        <Banner
          tone='warning'
          icon={<CreditCard className='size-5' />}
          title='A payment attempt failed'
        >
          {order.paymentFailureReason ?? 'The payment did not go through.'} The
          customer can still pay — this order has not been cancelled.
        </Banner>
      ) : null}

      <div className='grid gap-4 lg:grid-cols-[1fr_320px]'>
        <div className='space-y-4'>
          {/* ── Items ─────────────────────────────────────────────────────── */}
          <section className='rounded-lg bg-white p-5'>
            <h2 className='mb-3 font-medium'>Items</h2>
            <table className='w-full text-sm'>
              <thead className='border-b text-gray-500'>
                <tr>
                  <th className='pb-2 text-left font-normal'>Product</th>
                  <th className='pb-2 text-right font-normal'>Qty</th>
                  <th className='pb-2 text-right font-normal'>Price</th>
                  <th className='pb-2 text-right font-normal'>Total</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((item) => (
                  <tr key={item.id} className='border-b last:border-0'>
                    <td className='py-2.5'>
                      {item.productName}
                      {item.variantLabel ? (
                        <span className='text-gray-500'>
                          {' '}
                          · {item.variantLabel}
                        </span>
                      ) : null}
                    </td>
                    <td className='py-2.5 text-right tabular-nums'>
                      {item.quantity}
                    </td>
                    <td className='py-2.5 text-right tabular-nums'>
                      {formatCurrency(item.unitPriceKobo)}
                    </td>
                    <td className='py-2.5 text-right tabular-nums'>
                      {formatCurrency(item.unitPriceKobo * item.quantity)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <dl className='mt-4 space-y-1.5 border-t pt-3 text-sm'>
              <Row label='Subtotal' value={formatCurrency(order.subtotalKobo)} />
              {order.discountKobo > 0 ? (
                <Row
                  label={`Discount${order.coupon ? ` (${order.coupon.code})` : ''}`}
                  value={`−${formatCurrency(order.discountKobo)}`}
                />
              ) : null}
              <Row
                label='Delivery'
                value={
                  order.deliveryFeeKobo === 0
                    ? 'Free'
                    : formatCurrency(order.deliveryFeeKobo)
                }
              />
              <Row
                label='Total'
                value={formatCurrency(order.totalKobo)}
                emphasis
              />
              {order.paidAmountKobo !== null ? (
                <Row
                  label='Received via Paystack'
                  value={formatCurrency(order.paidAmountKobo)}
                />
              ) : null}
            </dl>
          </section>

          {/* Keyed on the order id: moving to a different order starts a fresh
              editor, while SWR revalidating THIS order does not wipe a note the
              merchant is halfway through typing. */}
          <NoteEditor
            key={order.id}
            initialNote={order.internalNote}
            onSave={async (note) => {
              await api.patch(`/stores/${storeSlug}/orders/${orderId}`, {
                internalNote: note,
              });
              await mutate();
            }}
          />
        </div>

        <div className='space-y-4'>
          {/* ── Actions ───────────────────────────────────────────────────── */}
          <section className='rounded-lg bg-white p-5'>
            <h2 className='mb-3 font-medium'>Update order</h2>
            {actions.length === 0 ? (
              <p className='text-sm text-gray-500'>
                This order is {badge.label.toLowerCase()} — there is nothing
                further to do.
              </p>
            ) : (
              <div className='flex flex-col gap-2'>
                {actions.map((to) => (
                  <Button
                    key={to}
                    variant={DESTRUCTIVE.includes(to) ? 'outline' : 'primary'}
                    fullWidth
                    disabled={saving}
                    onClick={() => setPending(to)}
                    className={cn(
                      DESTRUCTIVE.includes(to) && 'text-red-700',
                    )}
                  >
                    {ORDER_ACTION_LABEL[to]}
                  </Button>
                ))}
              </div>
            )}
          </section>

          {/* ── Customer ──────────────────────────────────────────────────── */}
          <section className='rounded-lg bg-white p-5 text-sm'>
            <h2 className='mb-3 font-medium'>Customer</h2>
            <p className='text-gray-900'>{order.customerName}</p>
            <a
              href={`mailto:${order.customerEmail}`}
              className='block text-gray-600 hover:underline'
            >
              {order.customerEmail}
            </a>
            <a
              href={`tel:${order.customerPhone}`}
              className='block text-gray-600 hover:underline'
            >
              {order.customerPhone}
            </a>
          </section>

          {/* ── Delivery ──────────────────────────────────────────────────── */}
          <section className='rounded-lg bg-white p-5 text-sm'>
            <h2 className='mb-3 font-medium'>Delivery</h2>
            {order.deliveryMethod === DeliveryMethod.PICKUP ? (
              <p className='text-gray-700'>Customer is picking up in store</p>
            ) : (
              <>
                <p className='text-gray-900'>
                  {order.deliveryZone?.name ?? 'Delivery area removed'}
                </p>
                <p className='whitespace-pre-line text-gray-600'>
                  {order.deliveryAddress ?? '—'}
                </p>
              </>
            )}
          </section>
        </div>
      </div>

      <Dialog
        open={pending !== null}
        onOpenChange={(open) => !open && setPending(null)}
      >
        <DialogContent>
          <DialogTitle>
            {pending ? ORDER_ACTION_LABEL[pending] : ''} — order #
            {order.orderNumber}
          </DialogTitle>
          {pending && consequenceOf(order.status, pending) ? (
            <p className='text-sm text-gray-600'>
              {consequenceOf(order.status, pending)}
            </p>
          ) : (
            <p className='text-sm text-gray-600'>
              The customer does not get a message from this change.
            </p>
          )}
          <div className='mt-4 flex justify-end gap-2'>
            <Button
              variant='outline'
              onClick={() => setPending(null)}
              disabled={saving}
            >
              Keep as is
            </Button>
            <Button
              variant={
                pending && DESTRUCTIVE.includes(pending) ? 'destructive' : 'primary'
              }
              isLoading={saving}
              onClick={() => void confirmTransition()}
            >
              {pending ? ORDER_ACTION_LABEL[pending] : 'Confirm'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * The merchant-only note.
 *
 * Owns its draft state, initialised from the saved note. Resetting it is done
 * by the parent's `key`, not an effect that copies props into state — that
 * pattern renders twice and, worse, overwrites an in-progress edit whenever the
 * order revalidates in the background.
 */
function NoteEditor({
  initialNote,
  onSave,
}: {
  initialNote: string | null;
  onSave: (note: string | null) => Promise<void>;
}) {
  const [note, setNote] = useState(initialNote ?? '');
  const [saved, setSaved] = useState(initialNote ?? '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await onSave(note.trim() || null);
      setSaved(note.trim());
      toast.success('Note saved');
    } catch (err) {
      handleApiError(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className='rounded-lg bg-white p-5'>
      <h2 className='font-medium'>Note</h2>
      <p className='mb-2 text-xs text-gray-500'>
        Only your team sees this. The customer never does.
      </p>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={3}
        maxLength={2000}
        placeholder='e.g. Customer asked for delivery after 4pm'
        className='w-full rounded-md border border-gray-200 p-3 text-sm outline-none focus:border-gray-400'
      />
      <div className='mt-2 flex justify-end'>
        <Button
          size='s'
          variant='outline'
          disabled={note.trim() === saved}
          isLoading={saving}
          onClick={() => void save()}
        >
          Save note
        </Button>
      </div>
    </section>
  );
}

function Row({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex justify-between',
        emphasis && 'border-t pt-1.5 font-medium text-gray-900',
      )}
    >
      <dt className={emphasis ? '' : 'text-gray-600'}>{label}</dt>
      <dd className='tabular-nums'>{value}</dd>
    </div>
  );
}

function Banner({
  tone,
  icon,
  title,
  action,
  children,
}: {
  tone: 'danger' | 'warning';
  icon: ReactNode;
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      role='alert'
      className={cn(
        'flex items-start gap-3 rounded-lg border p-4',
        tone === 'danger'
          ? 'border-red-200 bg-red-50 text-red-900'
          : 'border-amber-200 bg-amber-50 text-amber-900',
      )}
    >
      <span className='mt-0.5 shrink-0'>{icon}</span>
      <div className='flex-1 text-sm'>
        <p className='font-medium'>{title}</p>
        <p className='mt-0.5 opacity-90'>{children}</p>
      </div>
      {action}
    </div>
  );
}
