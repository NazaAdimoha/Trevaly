import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service';
import { OrderStatus } from '../../generated/prisma/enums';

import { koboFrom, settleRefund, stringFrom } from './webhook-payload';

/** What a handler did, for the webhook log. */
export type HandlerOutcome = { handled: boolean; note: string };

/**
 * Handlers for Paystack events other than `charge.success`, and the expiry
 * job. Ported unchanged from web's `lib/payments/webhook-events.ts`.
 *
 * Shared rule: an unknown reference is not an error. Paystack sends every event
 * for the whole integration; throwing would put it into a retry loop over an
 * event this API can never process.
 */
@Injectable()
export class WebhookEventsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * `charge.failed`. The order is NOT cancelled — a declined card is retried
   * and paid minutes later all the time. Only PENDING orders are touched.
   */
  async recordChargeFailure(
    reference: string,
    data: Record<string, unknown>,
  ): Promise<HandlerOutcome> {
    const reason =
      stringFrom(data.gateway_response) ?? stringFrom(data.message) ?? 'Payment failed';

    const result = await this.prisma.order.updateMany({
      where: { paymentReference: reference, status: OrderStatus.PENDING },
      data: { paymentFailedAt: new Date(), paymentFailureReason: reason },
    });

    return result.count > 0
      ? { handled: true, note: `Marked failed: ${reason}` }
      : { handled: false, note: 'No PENDING order for this reference' };
  }

  /**
   * `refund.processed`. Refunds accumulate; the status moves to REFUNDED only
   * once the full captured amount has gone back. Stock is deliberately NOT
   * restored — a refund moves money, not goods.
   */
  async applyRefund(reference: string, data: Record<string, unknown>): Promise<HandlerOutcome> {
    const order = await this.prisma.order.findUnique({
      where: { paymentReference: reference },
      select: {
        id: true,
        status: true,
        paidAmountKobo: true,
        totalKobo: true,
        refundedAmountKobo: true,
      },
    });
    if (!order) return { handled: false, note: 'No order for this reference' };

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

    await this.prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: order.id },
        data: {
          refundedAmountKobo: totalRefunded,
          refundedAt: new Date(),
          // A full refund resolves a paid-after-cancellation order; a partial
          // one does not — money is still held.
          ...(fullyRefunded ? { status: OrderStatus.REFUNDED, paidAfterCancellation: false } : {}),
        },
      });

      // Reverse, never delete, the platform's cut on a fully refunded payment.
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

  /** `charge.dispute.create` — a flag, never a status. */
  async openDispute(reference: string, data: Record<string, unknown>): Promise<HandlerOutcome> {
    const result = await this.prisma.order.updateMany({
      where: { paymentReference: reference },
      data: {
        disputedAt: new Date(),
        disputeStatus: stringFrom(data.status) ?? 'awaiting-merchant-feedback',
        disputeReason: stringFrom(data.reason) ?? stringFrom(data.category) ?? 'Chargeback raised',
        disputeAmountKobo: koboFrom(data.refund_amount) ?? koboFrom(data.amount) ?? null,
      },
    });
    return result.count > 0
      ? { handled: true, note: 'Dispute opened on order' }
      : { handled: false, note: 'No order for this reference' };
  }

  /** `charge.dispute.resolve` — `disputedAt` is kept as history. */
  async resolveDispute(reference: string, data: Record<string, unknown>): Promise<HandlerOutcome> {
    const result = await this.prisma.order.updateMany({
      where: { paymentReference: reference },
      data: {
        disputeStatus: stringFrom(data.status) ?? 'resolved',
        disputeReason: stringFrom(data.resolution) ?? stringFrom(data.reason) ?? undefined,
      },
    });
    return result.count > 0
      ? { handled: true, note: 'Dispute resolved on order' }
      : { handled: false, note: 'No order for this reference' };
  }

  /**
   * Close out PENDING orders never paid within the window. Time, not
   * `charge.failed`, is what guarantees an order stops sitting PENDING. Safe to
   * run repeatedly: status and `paymentVerifiedAt` are part of the `where`.
   */
  async expireStaleOrders(olderThanHours = 24): Promise<{ cancelled: number }> {
    const cutoff = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
    const result = await this.prisma.order.updateMany({
      where: {
        status: OrderStatus.PENDING,
        createdAt: { lt: cutoff },
        paymentVerifiedAt: null,
      },
      data: {
        status: OrderStatus.CANCELLED,
        internalNote: 'Cancelled automatically — no payment received',
      },
    });
    return { cancelled: result.count };
  }
}
