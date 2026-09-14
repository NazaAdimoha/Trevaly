import { prisma } from '@/lib/prisma';

import { OrderStatus } from '@/generated/prisma/client';

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
  if (order.status !== OrderStatus.PENDING) return order;

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
      return tx.order.findUniqueOrThrow({ where: { id: order.id } });
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
