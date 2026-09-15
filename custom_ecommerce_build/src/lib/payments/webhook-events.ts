 
import { prisma } from '@/lib/prisma';

import { OrderStatus } from '@/generated/prisma/enums';

import {
  extractReference,
  koboFrom,
  settleRefund,
  stringFrom,
} from './webhook-payload';

export { extractReference, settleRefund };

/**
 * Handlers for the Paystack events other than `charge.success`.
 *
 * Fulfilment lives in `./verify-order` and is deliberately untouched: it is the
 * one path that moves money into a merchant's hands, and everything here is
 * after-the-fact bookkeeping on an order that already exists.
 *
 * A shared rule across all of them: **an unknown reference is not an error.**
 * Paystack sends every event for the whole integration, including transactions
 * we never created (a merchant refunding something from a different system on
 * the same account). Throwing would return a 500 and put Paystack into a retry
 * loop over an event we will never be able to process.
 */

/** What a handler did, for the webhook log. */
export type HandlerOutcome =
  | { handled: true; note: string }
  | { handled: false; note: string };

/**
 * `charge.failed` — a payment attempt did not succeed.
 *
 * The order is NOT cancelled. A declined card is retried and paid minutes later
 * all the time, and cancelling here would delete a live sale from under the
 * customer. What was actually broken is that a failed attempt left no trace at
 * all, so a PENDING order looked identical whether the customer had abandoned
 * the cart, was still typing their PIN, or had been declined four times.
 *
 * Only touches orders still PENDING: a late-arriving failure for a transaction
 * that has since succeeded must never mark a paid order as failed.
 */
export async function recordChargeFailure(
  reference: string,
  data: Record<string, unknown>,
): Promise<HandlerOutcome> {
  const reason =
    stringFrom(data.gateway_response) ??
    stringFrom(data.message) ??
    'Payment failed';

  const result = await prisma.order.updateMany({
    where: { paymentReference: reference, status: OrderStatus.PENDING },
    data: { paymentFailedAt: new Date(), paymentFailureReason: reason },
  });

  return result.count > 0
    ? { handled: true, note: `Marked failed: ${reason}` }
    : { handled: false, note: 'No PENDING order for this reference' };
}

/**
 * `refund.processed` — money has gone back to the customer.
 *
 * Partial refunds are the reason this is not a one-line status update. Paystack
 * lets a merchant return ₦5,000 of a ₦40,000 order, and calling that order
 * REFUNDED would tell the merchant they have given back forty thousand naira
 * they still hold. So the amount accumulates, and the status only moves once
 * the full captured amount has been returned.
 *
 * Refunds accumulate rather than overwrite: two partial refunds on one order
 * are two events, and the second must not erase the first.
 *
 * STOCK IS DELIBERATELY NOT RESTORED. A refund is a movement of money, not of
 * goods — the item may be back on the shelf, on a bus, or gone. Silently adding
 * a unit back would let the storefront sell something that does not exist,
 * which is the exact oversell the fulfilment path works hard to prevent. The
 * merchant adjusts stock when the item is physically in front of them.
 */
export async function applyRefund(
  reference: string,
  data: Record<string, unknown>,
): Promise<HandlerOutcome> {
  const order = await prisma.order.findUnique({
    where: { paymentReference: reference },
    select: {
      id: true,
      status: true,
      paidAmountKobo: true,
      totalKobo: true,
      refundedAmountKobo: true,
    },
  });
  if (!order) {
    return { handled: false, note: 'No order for this reference' };
  }

  const refundAmount =
    koboFrom(data.amount) ??
    koboFrom((data.transaction as Record<string, unknown> | undefined)?.amount) ??
    0;
  if (refundAmount <= 0) {
    return { handled: false, note: 'Refund event carried no usable amount' };
  }

  const captured = order.paidAmountKobo ?? order.totalKobo;
  const { totalRefundedKobo: totalRefunded, fullyRefunded } = settleRefund(
    captured,
    order.refundedAmountKobo,
    refundAmount,
  );

  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: order.id },
      data: {
        refundedAmountKobo: totalRefunded,
        refundedAt: new Date(),
        // A full refund is one of the two ways a paid-after-cancellation order
        // gets resolved (the other is the merchant fulfilling it by hand), so it
        // clears that flag. A partial refund does not — money is still held.
        ...(fullyRefunded
          ? { status: OrderStatus.REFUNDED, paidAfterCancellation: false }
          : {}),
      },
    });

    // The platform's cut came out of a payment that has now been returned.
    // Reverse it rather than delete it — a period already reported must stay
    // reproducible.
    if (fullyRefunded) {
      await tx.platformEarning.updateMany({
        where: { orderId: order.id, reversedAt: null },
        data: { reversedAt: new Date() },
      });
    }
  });

  return {
    handled: true,
    note: fullyRefunded
      ? `Fully refunded (${totalRefunded} kobo); status REFUNDED, earning reversed`
      : `Partial refund (${totalRefunded} of ${captured} kobo); status unchanged`,
  };
}

/**
 * `charge.dispute.create` — the customer has charged back.
 *
 * Recorded as a flag, never as a status. A dispute can land on an order that is
 * already DELIVERED, and folding it into `status` would erase the fulfilment
 * state the merchant still needs to argue their case.
 *
 * `disputeStatus` stores Paystack's own string rather than a translation of it:
 * this is their vocabulary and their workflow, and inventing a parallel one
 * guarantees the two drift.
 */
export async function openDispute(
  reference: string,
  data: Record<string, unknown>,
): Promise<HandlerOutcome> {
  const result = await prisma.order.updateMany({
    where: { paymentReference: reference },
    data: {
      disputedAt: new Date(),
      disputeStatus: stringFrom(data.status) ?? 'awaiting-merchant-feedback',
      disputeReason:
        stringFrom(data.reason) ??
        stringFrom(data.category) ??
        'Chargeback raised',
      disputeAmountKobo:
        koboFrom(data.refund_amount) ?? koboFrom(data.amount) ?? null,
    },
  });

  return result.count > 0
    ? { handled: true, note: 'Dispute opened on order' }
    : { handled: false, note: 'No order for this reference' };
}

/**
 * `charge.dispute.resolve` — the dispute is closed.
 *
 * `disputedAt` is kept. The merchant needs to know this order was once disputed
 * even after it resolves in their favour — it is exactly the history you want
 * when the same customer disputes again.
 */
export async function resolveDispute(
  reference: string,
  data: Record<string, unknown>,
): Promise<HandlerOutcome> {
  const result = await prisma.order.updateMany({
    where: { paymentReference: reference },
    data: {
      disputeStatus: stringFrom(data.status) ?? 'resolved',
      disputeReason:
        stringFrom(data.resolution) ?? stringFrom(data.reason) ?? undefined,
    },
  });

  return result.count > 0
    ? { handled: true, note: 'Dispute resolved on order' }
    : { handled: false, note: 'No order for this reference' };
}

/**
 * Close out PENDING orders that were never paid.
 *
 * This — not `charge.failed` — is what actually guarantees an order stops
 * sitting PENDING forever. Paystack's documented event list does not include a
 * failed-charge event, and even where one exists it never fires for the most
 * common case of all: a customer who reaches the payment page and simply closes
 * the tab. Nothing is sent when nothing happens, so the only reliable mechanism
 * is time.
 *
 * Safe to run repeatedly and safe to run late:
 *
 *  - Only PENDING orders are touched, so an order paid between the query and
 *    the write is untouched — the status is part of the `where`, the same lock
 *    the fulfilment path uses.
 *  - No stock is released, because a PENDING order never held any. Stock is
 *    decremented inside the PAID claim in `verifyAndFulfillOrder`.
 *  - The window is deliberately generous. A Nigerian bank transfer can take
 *    hours to confirm, and cancelling a real payment that was merely slow is a
 *    far worse failure than an order list carrying a dead row for a day.
 */
export async function expireStaleOrders(
  olderThanHours = 24,
): Promise<{ cancelled: number }> {
  const cutoff = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);

  const result = await prisma.order.updateMany({
    where: {
      status: OrderStatus.PENDING,
      createdAt: { lt: cutoff },
      // Never touch an order the gateway has told us anything good about.
      paymentVerifiedAt: null,
    },
    data: {
      status: OrderStatus.CANCELLED,
      internalNote: 'Cancelled automatically — no payment received',
    },
  });

  return { cancelled: result.count };
}
