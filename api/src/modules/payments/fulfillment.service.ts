import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service';
import { type Order, OrderStatus, type Prisma } from '../../generated/prisma/client';
import { PaystackService } from '../../integrations/paystack.service';

import { paymentDecision } from './payment-decision';

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

type Tx = Prisma.TransactionClient;

/**
 * The single source of truth for "is this order actually paid".
 *
 * Ported line for line from web's `lib/payments/verify-order.ts`, keeping the
 * function name so every rule can be found by searching for the old one.
 * Called from exactly two places — the verify route and the webhook.
 *
 * Idempotent in the DATABASE, not in this code: the PENDING→PAID claim is a
 * conditional updateMany, the earning is unique per order with skipDuplicates,
 * and the late-payment record is conditional on `paymentVerifiedAt IS NULL`.
 * That is what lets this and web's copy overlap safely during cutover.
 */
@Injectable()
export class FulfillmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paystack: PaystackService,
  ) {}

  async verifyAndFulfillOrder(reference: string) {
    const order = await this.prisma.order.findUnique({
      where: { paymentReference: reference },
      include: { items: true },
    });

    if (!order) throw new OrderNotFoundError(reference);

    // A cancelled, never-paid order falls through to the same verification as
    // a pending one — nothing is recorded on the webhook's word alone.
    const decision = paymentDecision(order);
    if (decision === 'already-settled') return order;

    const transaction = await this.paystack.verifyTransaction(reference);

    if (transaction.status !== 'success') {
      throw new PaymentVerificationError(
        `Transaction ${reference} is "${transaction.status}", not "success"`,
      );
    }

    // Guard every dimension the customer could influence.
    if (transaction.reference !== reference) {
      throw new PaymentVerificationError('Reference mismatch');
    }
    if (transaction.amount !== order.totalKobo) {
      throw new PaymentVerificationError(
        `Amount mismatch: charged ${transaction.amount}, expected ${order.totalKobo}`,
      );
    }
    if (transaction.currency !== 'NGN') {
      throw new PaymentVerificationError(`Unexpected currency ${transaction.currency}`);
    }

    return this.prisma.$transaction(async (tx) => {
      if (decision === 'record-late') {
        return this.recordLatePayment(tx, order, transaction.amount);
      }

      // Claim the order before touching anything else. The webhook and the
      // browser's verify routinely race; the status transition is the lock.
      const claim = await tx.order.updateMany({
        where: { id: order.id, status: OrderStatus.PENDING },
        data: {
          status: OrderStatus.PAID,
          paymentVerifiedAt: new Date(),
          paidAmountKobo: transaction.amount,
        },
      });

      if (claim.count === 0) {
        // Lost the race — usually to the other verifier. If a merchant
        // cancelled in between, the payment is just as real: record it.
        const current = await tx.order.findUniqueOrThrow({ where: { id: order.id } });
        return paymentDecision(current) === 'record-late'
          ? this.recordLatePayment(tx, order, transaction.amount)
          : current;
      }

      let hasStockIssue = false;

      for (const item of order.items) {
        // Conditional decrement on the row actually sold from (the variant when
        // the line has one). A plain decrement drives stock negative.
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

      // The platform's earning, inside the claim. createMany + skipDuplicates:
      // a bookkeeping row must never be able to roll back a fulfilment.
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
        // Prisma cannot compare two columns in a `where`; raw SQL keeps the
        // usage cap atomic under concurrent checkouts.
        await tx.$executeRaw`
          UPDATE "Coupon"
          SET "timesUsed" = "timesUsed" + 1
          WHERE "id" = ${order.couponId}
            AND ("maxUses" IS NULL OR "timesUsed" < "maxUses")`;
      }

      // Already PAID by the claim; all that is left is to flag a stock problem.
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

  /**
   * A verified payment landed on an order that was already CANCELLED.
   *
   * The order stays CANCELLED. Money is recorded and flagged; the earning is
   * written because Paystack really took the charge. Stock and coupon usage are
   * deliberately untouched. Idempotent: conditional on `paymentVerifiedAt IS
   * NULL`, and the earning uses skipDuplicates.
   */
  private async recordLatePayment(
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
      where: { id: order.id, status: OrderStatus.CANCELLED, paymentVerifiedAt: null },
      data: { paymentVerifiedAt: new Date(), paidAmountKobo, paidAfterCancellation: true },
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
}
