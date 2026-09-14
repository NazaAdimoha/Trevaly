import { describe, expect, it } from 'vitest';

import {
  computeDiscountKobo,
  couponRejectionReason,
} from '@core/validation/coupon';

import { CouponType } from '@/generated/prisma/client';

const FUTURE = new Date(Date.now() + 86_400_000);
const PAST = new Date(Date.now() - 86_400_000);

const base = {
  isActive: true,
  expiresAt: null,
  maxUses: null,
  timesUsed: 0,
  minOrderKobo: 0,
};

describe('computeDiscountKobo', () => {
  it('takes a percentage of the subtotal', () => {
    expect(
      computeDiscountKobo(
        { type: CouponType.PERCENTAGE, value: 10 },
        2_500_000,
      ),
    ).toBe(250_000);
  });

  it('rounds percentage discounts to whole kobo', () => {
    // 33% of 1001 kobo = 330.33 — a float here would leak fractions of a kobo
    // into the order total.
    const discount = computeDiscountKobo(
      { type: CouponType.PERCENTAGE, value: 33 },
      1_001,
    );
    expect(Number.isInteger(discount)).toBe(true);
    expect(discount).toBe(330);
  });

  it('applies a fixed discount as-is', () => {
    expect(
      computeDiscountKobo(
        { type: CouponType.FIXED, value: 500_000 },
        2_500_000,
      ),
    ).toBe(500_000);
  });

  // Without the clamp, a ₦5,000 coupon on a ₦2,000 cart yields a negative
  // total — which checkout would then try to charge.
  it('never discounts more than the subtotal', () => {
    expect(
      computeDiscountKobo({ type: CouponType.FIXED, value: 500_000 }, 200_000),
    ).toBe(200_000);
  });

  it('caps a 100% coupon at the subtotal, not below zero', () => {
    expect(
      computeDiscountKobo({ type: CouponType.PERCENTAGE, value: 100 }, 200_000),
    ).toBe(200_000);
  });
});

describe('couponRejectionReason', () => {
  it('accepts a valid coupon', () => {
    expect(couponRejectionReason(base, 100_000)).toBeNull();
  });

  it('rejects a missing coupon', () => {
    expect(couponRejectionReason(null, 100_000)).toBe('Coupon not found');
  });

  it('rejects an inactive coupon', () => {
    expect(couponRejectionReason({ ...base, isActive: false }, 100_000)).toBe(
      'This coupon is no longer active',
    );
  });

  it('rejects an expired coupon', () => {
    expect(couponRejectionReason({ ...base, expiresAt: PAST }, 100_000)).toBe(
      'This coupon has expired',
    );
  });

  it('accepts a coupon expiring in the future', () => {
    expect(
      couponRejectionReason({ ...base, expiresAt: FUTURE }, 100_000),
    ).toBeNull();
  });

  it('rejects a fully-used coupon', () => {
    expect(
      couponRejectionReason({ ...base, maxUses: 5, timesUsed: 5 }, 100_000),
    ).toBe('This coupon has been fully used');
  });

  it('allows the final use', () => {
    expect(
      couponRejectionReason({ ...base, maxUses: 5, timesUsed: 4 }, 100_000),
    ).toBeNull();
  });

  it('treats a null maxUses as unlimited', () => {
    expect(
      couponRejectionReason(
        { ...base, maxUses: null, timesUsed: 9_999 },
        100_000,
      ),
    ).toBeNull();
  });

  it('rejects an order below the minimum', () => {
    expect(
      couponRejectionReason({ ...base, minOrderKobo: 500_000 }, 499_999),
    ).toBe('Your order is below this coupon’s minimum');
  });

  it('accepts an order exactly at the minimum', () => {
    expect(
      couponRejectionReason({ ...base, minOrderKobo: 500_000 }, 500_000),
    ).toBeNull();
  });
});
