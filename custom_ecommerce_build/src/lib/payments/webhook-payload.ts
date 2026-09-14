/**
 * Pure payload parsing and refund arithmetic for Paystack webhooks.
 *
 * Deliberately free of any database import. Its sibling `./webhook-events`
 * imports `prisma`, which opens a connection at module load — that made the
 * arithmetic below untestable without a live Postgres, which is exactly
 * backwards for the one part of this feature that decides whether a merchant is
 * told they refunded money they still hold.
 */

/**
 * Pull the order reference out of an event payload.
 *
 * Different event families nest it differently — a charge carries it at the
 * top, a refund and a dispute carry the transaction they concern. Rather than
 * hard-code one shape per event and discover the mistake in production, check
 * the known locations in order. Returning null is a normal outcome, not a bug.
 */
export function extractReference(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;

  const direct = d.reference;
  if (typeof direct === 'string' && direct) return direct;

  const transactionRef = d.transaction_reference;
  if (typeof transactionRef === 'string' && transactionRef) return transactionRef;

  const nested = d.transaction;
  if (nested && typeof nested === 'object') {
    const ref = (nested as Record<string, unknown>).reference;
    if (typeof ref === 'string' && ref) return ref;
  }

  return null;
}

/** Paystack amounts are already in the minor unit (kobo). */
export function koboFrom(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.round(value)
    : null;
}

export function stringFrom(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/**
 * Work out where a refund leaves an order.
 *
 * Pure, and separated from the database call on purpose: this is the arithmetic
 * that decides whether a merchant is told they have given back money they still
 * hold, and it should be testable without a Postgres connection.
 */
export function settleRefund(
  capturedKobo: number,
  alreadyRefundedKobo: number,
  incomingKobo: number,
): { totalRefundedKobo: number; fullyRefunded: boolean } {
  const totalRefundedKobo = alreadyRefundedKobo + incomingKobo;

  // `>=`, not `===`. Gateway-side rounding on a split payment can return a
  // kobo more or less than we captured, and an equality check would leave a
  // fully-refunded order stuck one kobo short of REFUNDED forever.
  return {
    totalRefundedKobo,
    fullyRefunded: capturedKobo > 0 && totalRefundedKobo >= capturedKobo,
  };
}
