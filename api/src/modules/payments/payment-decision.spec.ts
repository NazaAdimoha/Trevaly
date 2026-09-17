import { describe, expect, it } from 'vitest';

import { paymentDecision } from './payment-decision';

import { OrderStatus } from '../../generated/prisma/enums';

/**
 * The branch that decides what a verified payment does to its order.
 *
 * The regression this pins: a successful payment for a CANCELLED order used to
 * return early and record nothing. Paystack had captured and settled the money;
 * the store had no trace of it.
 */
describe('paymentDecision', () => {
  const NEVER = null;
  const AT = new Date('2026-09-15T08:00:00Z');

  it('fulfils a pending order', () => {
    expect(
      paymentDecision({ status: OrderStatus.PENDING, paymentVerifiedAt: NEVER }),
    ).toBe('fulfil');
  });

  it('records — does not drop — a payment on a cancelled, never-paid order', () => {
    expect(
      paymentDecision({ status: OrderStatus.CANCELLED, paymentVerifiedAt: NEVER }),
    ).toBe('record-late');
  });

  // Idempotency: a redelivered webhook after the late payment is on the books.
  it('treats a cancelled order whose late payment is already recorded as settled', () => {
    expect(
      paymentDecision({ status: OrderStatus.CANCELLED, paymentVerifiedAt: AT }),
    ).toBe('already-settled');
  });

  it.each([
    OrderStatus.PAID,
    OrderStatus.SHIPPED,
    OrderStatus.DELIVERED,
    OrderStatus.REFUNDED,
  ])('treats a %s order as already settled', (status) => {
    expect(paymentDecision({ status, paymentVerifiedAt: AT })).toBe(
      'already-settled',
    );
  });

  it('never fulfils anything that is not pending', () => {
    for (const status of Object.values(OrderStatus)) {
      if (status === OrderStatus.PENDING) continue;
      for (const paymentVerifiedAt of [NEVER, AT]) {
        expect(paymentDecision({ status, paymentVerifiedAt })).not.toBe('fulfil');
      }
    }
  });
});
