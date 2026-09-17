import { OrderStatus } from '../../generated/prisma/enums';

/**
 * What a verified successful payment should do to the order it names.
 * Ported unchanged from web.
 *
 *   fulfil           PENDING — claim PAID, take stock, record the earning.
 *   record-late      CANCELLED and never paid — record and flag; do not fulfil.
 *                    (Owner's decision, 2026-09-15.)
 *   already-settled  Anything else: a redelivered webhook, a second verify, or
 *                    a late payment already recorded.
 */
export type PaymentDecision = 'fulfil' | 'record-late' | 'already-settled';

export function paymentDecision(order: {
  status: OrderStatus;
  paymentVerifiedAt: Date | null;
}): PaymentDecision {
  if (order.status === OrderStatus.PENDING) return 'fulfil';
  if (order.status === OrderStatus.CANCELLED && order.paymentVerifiedAt === null) {
    return 'record-late';
  }
  return 'already-settled';
}
