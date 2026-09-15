import { OrderStatus } from '@/generated/prisma/enums';

/**
 * What a verified successful payment should do to the order it names.
 *
 * Pure, and deliberately separate from `verify-order.ts`, which imports Prisma:
 * this is the branch that decides whether a customer's money gets fulfilled,
 * recorded, or treated as already handled, and it must be testable without a
 * database.
 *
 *   fulfil           PENDING — the normal path: claim PAID, take stock, record
 *                    the platform's earning.
 *   record-late      CANCELLED and never paid — money arrived for an order that
 *                    had already been closed. Record it and flag it; do not
 *                    fulfil. (Owner's decision, 2026-09-15.)
 *   already-settled  Anything else: a redelivered webhook or a second verify for
 *                    an order that is already PAID/SHIPPED/DELIVERED/REFUNDED, or
 *                    a late payment that has already been recorded.
 *
 * `paymentVerifiedAt` is what distinguishes a CANCELLED order that never saw
 * money from one whose late payment is already on the books — so a webhook
 * redelivery cannot record the same payment twice.
 */
export type PaymentDecision = 'fulfil' | 'record-late' | 'already-settled';

export function paymentDecision(order: {
  status: OrderStatus;
  paymentVerifiedAt: Date | null;
}): PaymentDecision {
  if (order.status === OrderStatus.PENDING) return 'fulfil';
  if (
    order.status === OrderStatus.CANCELLED &&
    order.paymentVerifiedAt === null
  ) {
    return 'record-late';
  }
  return 'already-settled';
}
