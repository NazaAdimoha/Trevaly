import { prisma } from '@/lib/prisma';

import { type Order, OrderStatus } from '@/generated/prisma/client';

import { paymentDecision } from './payment-decision';
import { verifyTransaction } from './paystack';

/**
 * The single source of truth for "is this order actually paid".
 *
 * Called from exactly two places — the client-triggered verify route and the
 * gateway webhook — so verification and fulfillment cannot drift apart. Never
 * write order-fulfillment logic anywhere else.
 *
 * Idempotent by construction: `Order.paymentReference` is globally unique, and
 * an already-PAID order short-circuits. Whichever path arrives first wins; the
 * other no-ops.
 *
 * A payment for a CANCELLED order is recorded and flagged, never dropped — see
 * `recordLatePayment` below and `paymentDecision` for the full branch table.
 */

export class OrderNotFoundError extends Error {
  constructor(reference: string) {
    super(`No order for payment reference ${reference}`);
    this.name = 'OrderNotFoundError';
  }
}

export class PaymentVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PaymentVerificationError';
  }
}

export async function verifyAndFulfillOrder(reference: string) {
  const order = await prisma.order.findUnique({
    where: { paymentReference: reference },
    include: { items: true },
  });

  if (!order) throw new OrderNotFoundError(reference);

  // This used to be `if (order.status !== PENDING) return order`, which
  // silently discarded a successful payment for an order that had been
  // cancelled: Paystack captured and settled the money, and we recorded nothing.
  // A cancelled, never-paid order now falls through to the same verification as
  // a pending one — nothing is recorded on the webhook's word alone.
  const decision = paymentDecision(order);
  if (decision === 'already-settled') return order;

  const transaction = await verifyTransaction(reference);

  if (transaction.status !== 'success') {
    throw new PaymentVerificationError(
      `Transaction ${reference} is "${transaction.status}", not "success"`,
    );
  }

  // Guard every dimension the customer could influence. The amount check is
  // what stops a cheap charge being replayed against an expensive order; the
  // reference and currency checks close the equivalent substitution holes.
  if (transaction.reference !== reference) {
    throw new PaymentVerificationError('Reference mismatch');
  }
  if (transaction.amount !== order.totalKobo) {
    throw new PaymentVerificationError(
      `Amount mismatch: charged ${transaction.amount}, expected ${order.totalKobo}`,
    );
  }
  if (transaction.currency !== 'NGN') {
    throw new PaymentVerificationError(
      `Unexpected currency ${transaction.currency}`,
    );
  }

  return prisma.$transaction(async (tx) => {
    if (decision === 'record-late') {
      return recordLatePayment(tx, order, transaction.amount);
    }

    // Claim the order before touching anything else.
    //
    // The PENDING check at the top of this function is not enough on its own:
    // the webhook and the browser's verify call routinely arrive within
    // milliseconds of each other, both read PENDING, and both then run the
    // decrements below — taking two units of stock for one purchase and
    // burning two uses of a single-use coupon. Making the status transition
    // itself the lock means exactly one caller ever gets past this point.
    const claim = await tx.order.updateMany({
      where: { id: order.id, status: OrderStatus.PENDING },
      data: {
        status: OrderStatus.PAID,
        paymentVerifiedAt: new Date(),
        paidAmountKobo: transaction.amount,
      },
    });

    if (claim.count === 0) {
      // Lost the race. Almost always to the other verifier (webhook vs browser),
      // in which case the order is PAID and there is nothing to do. But if a
      // merchant cancelled it in the milliseconds between our read and this
      // claim, the payment is just as real — record it rather than drop it.
      const current = await tx.order.findUniqueOrThrow({
        where: { id: order.id },
      });
      return paymentDecision(current) === 'record-late'
        ? recordLatePayment(tx, order, transaction.amount)
        : current;
    }

    let hasStockIssue = false;

    for (const item of order.items) {
      // Conditional decrement. A plain `{ decrement }` lets two concurrent
      // buyers of the last unit both succeed and drives stock negative.
      //
      // The row it guards is the variant when the line has one. Decrementing
      // the parent product instead would take a unit from a pool nothing sells
      // from and leave the size that was actually bought still showing in
      // stock — an oversell that looks like nothing went wrong.
      const { count } = item.variantId
        ? await tx.productVariant.updateMany({
            where: { id: item.variantId, stock: { gte: item.quantity } },
            data: { stock: { decrement: item.quantity } },
          })
        : await tx.product.updateMany({
            where: { id: item.productId, stock: { gte: item.quantity } },
            data: { stock: { decrement: item.quantity } },
          });

      if (count === 0) hasStockIssue = true;
    }

    // Record what the platform earned on this order.
    //
    // Inside the claim, so it is written once per fulfillment however many
    // callers race — the same guarantee the stock decrement relies on. Without
    // this row the platform's revenue lives only inside Paystack, and there is
    // nothing to reconcile a settlement against.
    //
    // `createMany` + `skipDuplicates` rather than `create`, and the difference
    // matters: an order that is re-fulfilled — a replayed webhook after an
    // operator reset it to PENDING, for instance — already has an earning row,
    // and a plain `create` would raise a unique violation on `orderId` that
    // rolls back this entire transaction, un-doing the PAID claim and the stock
    // decrements with it. A bookkeeping row must never be able to fail a
    // fulfillment. The existing row also wins deliberately: a ledger entry that
    // silently changes value after the fact is worse than a stale one.
    if (order.platformFeeKobo > 0) {
      await tx.platformEarning.createMany({
        data: [
          {
            tenantId: order.tenantId,
            orderId: order.id,
            reference: order.paymentReference,
            provider: order.paymentProvider,
            amountKobo: order.platformFeeKobo,
            feePercent: order.platformFeePercent,
            orderTotalKobo: order.totalKobo,
          },
        ],
        skipDuplicates: true,
      });
    }

    if (order.couponId) {
      // Prisma cannot compare two columns in a `where`, so the usage cap needs
      // raw SQL to stay atomic. Without it, concurrent checkouts overrun maxUses.
      await tx.$executeRaw`
        UPDATE "Coupon"
        SET "timesUsed" = "timesUsed" + 1
        WHERE "id" = ${order.couponId}
          AND ("maxUses" IS NULL OR "timesUsed" < "maxUses")`;
    }

    // The order was already marked PAID by the claim above — the customer's
    // money has moved and that fact is recorded even if stock ran out
    // underneath us. All that is left is to flag it for the tenant to resolve.
    return tx.order.update({
      where: { id: order.id },
      data: {
        hasStockIssue,
        ...(hasStockIssue
          ? {
              internalNote:
                'Paid, but stock was unavailable at fulfillment. Refund or backorder.',
            }
          : {}),
      },
    });
  });
}

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/**
 * A verified payment landed on an order that was already CANCELLED.
 *
 * The order stays CANCELLED — nothing is fulfilled automatically. What changes
 * is that the money is on the books and in front of the merchant:
 *
 *   - `paidAmountKobo` and `paymentVerifiedAt` record what Paystack captured.
 *   - `paidAfterCancellation` flags it for a decision: send the order by hand,
 *     or refund. A full refund clears the flag (`applyRefund`).
 *   - The platform's earning is written, because Paystack really did take the
 *     `transaction_charge` at settlement. A refund reverses it, as for any order.
 *
 * Deliberately NOT done:
 *
 *   - Stock is not decremented. The order was closed and may never ship; taking
 *     units now could mark something out of stock that is still on the shelf.
 *     A merchant who fulfils it adjusts stock when they pack it.
 *   - Coupon usage is not counted. The sale has not completed, and may yet be
 *     refunded.
 *
 * Idempotent: the update is conditional on `paymentVerifiedAt IS NULL`, so a
 * redelivered webhook or a second verify finds nothing to claim and returns the
 * already-recorded order; the earning uses `skipDuplicates`.
 */
async function recordLatePayment(
  tx: Tx,
  order: Pick<
    Order,
    | 'id'
    | 'tenantId'
    | 'paymentReference'
    | 'paymentProvider'
    | 'platformFeeKobo'
    | 'platformFeePercent'
    | 'totalKobo'
  >,
  paidAmountKobo: number,
) {
  const recorded = await tx.order.updateMany({
    where: {
      id: order.id,
      status: OrderStatus.CANCELLED,
      paymentVerifiedAt: null,
    },
    data: {
      paymentVerifiedAt: new Date(),
      paidAmountKobo,
      paidAfterCancellation: true,
    },
  });

  if (recorded.count > 0 && order.platformFeeKobo > 0) {
    await tx.platformEarning.createMany({
      data: [
        {
          tenantId: order.tenantId,
          orderId: order.id,
          reference: order.paymentReference,
          provider: order.paymentProvider,
          amountKobo: order.platformFeeKobo,
          feePercent: order.platformFeePercent,
          orderTotalKobo: order.totalKobo,
        },
      ],
      skipDuplicates: true,
    });
  }

  return tx.order.findUniqueOrThrow({ where: { id: order.id } });
}
