import { describe, expect, it } from 'vitest';

import { checkoutSchema, mergeCartItems } from '@core/validation/checkout';

const validPayload = {
  items: [{ productId: 'prod_1', quantity: 2 }],
  customerName: 'Adaobi Okeke',
  customerEmail: 'adaobi@example.com',
  customerPhone: '08031234567',
  deliveryMethod: 'ZONE_DELIVERY',
  deliveryZoneId: 'zone_1',
  deliveryAddress: '12 Awolowo Road, Ikoyi',
};

describe('checkoutSchema', () => {
  it('accepts a well-formed delivery order', () => {
    expect(checkoutSchema.safeParse(validPayload).success).toBe(true);
  });

  // Regression: without an integer/min(1) bound, a negative quantity subtracts
  // from the subtotal and drives a real order to ~zero. Every server-side total
  // downstream would agree, because the maths itself is correct.
  it('rejects negative quantities', () => {
    const result = checkoutSchema.safeParse({
      ...validPayload,
      items: [
        { productId: 'prod_1', quantity: 1 },
        { productId: 'prod_2', quantity: -49 },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('rejects zero and fractional quantities', () => {
    for (const quantity of [0, 0.5, 1.5]) {
      const result = checkoutSchema.safeParse({
        ...validPayload,
        items: [{ productId: 'prod_1', quantity }],
      });
      expect(result.success, `quantity ${quantity} should be rejected`).toBe(
        false,
      );
    }
  });

  it('requires a zone and address for ZONE_DELIVERY', () => {
    const { deliveryZoneId: _z, deliveryAddress: _a, ...rest } = validPayload;
    expect(checkoutSchema.safeParse(rest).success).toBe(false);
  });

  it('allows PICKUP without a zone or address', () => {
    const { deliveryZoneId: _z, deliveryAddress: _a, ...rest } = validPayload;
    const result = checkoutSchema.safeParse({
      ...rest,
      deliveryMethod: 'PICKUP',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a malformed Nigerian phone number', () => {
    const result = checkoutSchema.safeParse({
      ...validPayload,
      customerPhone: '12345',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an empty cart', () => {
    expect(
      checkoutSchema.safeParse({ ...validPayload, items: [] }).success,
    ).toBe(false);
  });
});

describe('mergeCartItems', () => {
  // Regression: the original checkout compared products.length to
  // productIds.length, so a cart listing the same product twice was rejected
  // as "unavailable".
  it('collapses duplicate lines into one, summing quantity', () => {
    const merged = mergeCartItems([
      { productId: 'prod_1', quantity: 1 },
      { productId: 'prod_2', quantity: 3 },
      { productId: 'prod_1', quantity: 2 },
    ]);

    expect(merged).toHaveLength(2);
    // `variantId` is normalised onto every line — see the variant-aware
    // merging rules in `variants.test.ts`.
    expect(merged).toContainEqual({
      productId: 'prod_1',
      variantId: null,
      quantity: 3,
    });
    expect(merged).toContainEqual({
      productId: 'prod_2',
      variantId: null,
      quantity: 3,
    });
  });

  it('is a no-op for already-unique carts, bar the normalised variantId', () => {
    const items = [{ productId: 'prod_1', quantity: 1 }];
    expect(mergeCartItems(items)).toEqual([
      { productId: 'prod_1', variantId: null, quantity: 1 },
    ]);
  });
});
