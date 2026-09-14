import { describe, expect, it } from 'vitest';

import { extractReference, settleRefund } from '@/lib/payments/webhook-payload';

/**
 * The reference is how every event finds its order. Paystack nests it
 * differently per event family, and getting it wrong means a refund silently
 * never lands — the failure mode is silence, which is why it is worth pinning.
 */
describe('extractReference', () => {
  it('reads a charge event, where it sits at the top level', () => {
    expect(extractReference({ reference: 'ord_abc' })).toBe('ord_abc');
  });

  it('reads a refund event, which names the transaction it refunds', () => {
    expect(extractReference({ transaction_reference: 'ord_abc' })).toBe(
      'ord_abc',
    );
  });

  it('reads a dispute event, which nests the whole transaction', () => {
    expect(
      extractReference({ transaction: { reference: 'ord_abc', id: 1 } }),
    ).toBe('ord_abc');
  });

  it('prefers the top-level reference when more than one is present', () => {
    expect(
      extractReference({
        reference: 'ord_top',
        transaction: { reference: 'ord_nested' },
      }),
    ).toBe('ord_top');
  });

  // A null here must be treated as "not ours", never as an error: Paystack
  // sends every event on the integration, including transactions we never made.
  it.each([null, undefined, 'string', 42, {}, { reference: '' }])(
    'returns null for %p rather than throwing',
    (input) => {
      expect(extractReference(input)).toBeNull();
    },
  );
});

describe('settleRefund', () => {
  it('marks a full refund as full', () => {
    expect(settleRefund(40_000_00, 0, 40_000_00)).toEqual({
      totalRefundedKobo: 40_000_00,
      fullyRefunded: true,
    });
  });

  // The case that makes this worth a function: calling a partial refund "full"
  // tells a merchant they have returned money they are still holding.
  it('does not mark a partial refund as full', () => {
    expect(settleRefund(40_000_00, 0, 5_000_00)).toEqual({
      totalRefundedKobo: 5_000_00,
      fullyRefunded: false,
    });
  });

  it('accumulates across several partial refunds', () => {
    const first = settleRefund(40_000_00, 0, 15_000_00);
    expect(first.fullyRefunded).toBe(false);

    const second = settleRefund(40_000_00, first.totalRefundedKobo, 25_000_00);
    expect(second).toEqual({ totalRefundedKobo: 40_000_00, fullyRefunded: true });
  });

  // Regression: an equality check leaves an order one kobo short of REFUNDED
  // forever when the gateway rounds a split payment.
  it('treats an over-refund by rounding as full', () => {
    expect(settleRefund(40_000_00, 0, 40_000_01).fullyRefunded).toBe(true);
  });

  it('never calls a zero-captured order refunded', () => {
    expect(settleRefund(0, 0, 0).fullyRefunded).toBe(false);
  });
});
