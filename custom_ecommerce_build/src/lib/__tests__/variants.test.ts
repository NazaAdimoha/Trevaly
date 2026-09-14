import { describe, expect, it } from 'vitest';

import { cartLineKey, mergeCartItems } from '@core/validation/checkout';
import {
  activeVariants,
  availableStock,
  displayPriceKobo,
  hasPriceRange,
  hasVariants,
  isSoldOut,
  type ProductLike,
  variantLabel,
  variantPriceKobo,
} from '@core/variants';

function variant(over: Partial<ProductLike['variants'][number]> = {}) {
  return {
    id: 'v1',
    value: 'M',
    priceKobo: null,
    stock: 5,
    isActive: true,
    position: 0,
    ...over,
  };
}

function product(over: Partial<ProductLike> = {}): ProductLike {
  return {
    priceKobo: 25_000_00,
    stock: 10,
    optionName: null,
    variants: [],
    ...over,
  };
}

describe('variant pricing', () => {
  it('inherits the product price when the variant does not override it', () => {
    const p = product({ optionName: 'Size', variants: [variant()] });
    expect(variantPriceKobo(p, p.variants[0])).toBe(25_000_00);
  });

  it('treats a null override as "inherit", never as free', () => {
    const p = product({ priceKobo: 5_000_00 });
    expect(variantPriceKobo(p, { priceKobo: null })).toBe(5_000_00);
    expect(variantPriceKobo(p, null)).toBe(5_000_00);
  });

  it('uses the override when one is set', () => {
    const p = product({ optionName: 'Size' });
    expect(variantPriceKobo(p, { priceKobo: 30_000_00 })).toBe(30_000_00);
  });

  it('shows the cheapest live option as the display price', () => {
    const p = product({
      priceKobo: 20_000_00,
      optionName: 'Size',
      variants: [
        variant({ id: 'a', value: 'S', priceKobo: 18_000_00 }),
        variant({ id: 'b', value: 'L', priceKobo: 24_000_00 }),
      ],
    });
    expect(displayPriceKobo(p)).toBe(18_000_00);
    expect(hasPriceRange(p)).toBe(true);
  });

  it('does not claim a range when every option costs the same', () => {
    const p = product({
      optionName: 'Size',
      variants: [variant({ id: 'a' }), variant({ id: 'b', value: 'L' })],
    });
    expect(hasPriceRange(p)).toBe(false);
  });

  it('ignores an inactive option when pricing', () => {
    const p = product({
      priceKobo: 20_000_00,
      optionName: 'Size',
      variants: [
        variant({ id: 'a', value: 'S', priceKobo: 9_00, isActive: false }),
        variant({ id: 'b', value: 'L', priceKobo: 24_000_00 }),
      ],
    });
    expect(displayPriceKobo(p)).toBe(24_000_00);
  });
});

describe('variant availability', () => {
  it('reads stock from the product when there are no variants', () => {
    expect(availableStock(product({ stock: 7 }))).toBe(7);
    expect(isSoldOut(product({ stock: 0 }))).toBe(true);
  });

  it('ignores Product.stock entirely once variants exist', () => {
    // The regression this guards: a product left with stock 10 from before
    // options were added must not look purchasable when every option is gone.
    const p = product({
      stock: 10,
      optionName: 'Size',
      variants: [
        variant({ stock: 0 }),
        variant({ id: 'b', value: 'L', stock: 0 }),
      ],
    });
    expect(availableStock(p)).toBe(0);
    expect(isSoldOut(p)).toBe(true);
  });

  it('stays in stock while any one option has units', () => {
    const p = product({
      stock: 0,
      optionName: 'Size',
      variants: [
        variant({ id: 'a', value: 'S', stock: 0 }),
        variant({ id: 'b', value: 'L', stock: 3 }),
      ],
    });
    expect(isSoldOut(p)).toBe(false);
    expect(availableStock(p)).toBe(3);
  });

  it('does not count inactive options as sellable', () => {
    const p = product({
      stock: 0,
      optionName: 'Size',
      variants: [variant({ stock: 9, isActive: false })],
    });
    expect(hasVariants(p)).toBe(false);
    expect(availableStock(p)).toBe(0);
  });

  it('keeps the merchant ordering rather than sorting alphabetically', () => {
    const p = product({
      optionName: 'Size',
      variants: [
        variant({ id: 'c', value: 'L', position: 2 }),
        variant({ id: 'a', value: 'S', position: 0 }),
        variant({ id: 'b', value: 'M', position: 1 }),
      ],
    });
    expect(activeVariants(p).map((v) => v.value)).toEqual(['S', 'M', 'L']);
  });
});

describe('variant labels', () => {
  it('reads as "Size: Small" so a receipt stands alone', () => {
    expect(variantLabel('Size', 'Small')).toBe('Size: Small');
  });

  it('falls back to the bare value when the option is unnamed', () => {
    expect(variantLabel(null, 'Small')).toBe('Small');
  });
});

describe('cart line merging', () => {
  it('merges duplicate lines of the same product and variant', () => {
    const merged = mergeCartItems([
      { productId: 'p1', variantId: 'v1', quantity: 1 },
      { productId: 'p1', variantId: 'v1', quantity: 2 },
    ]);
    expect(merged).toEqual([{ productId: 'p1', variantId: 'v1', quantity: 3 }]);
  });

  it('keeps two variants of one product apart', () => {
    // Merging on productId alone would collapse these and ship the wrong size.
    const merged = mergeCartItems([
      { productId: 'p1', variantId: 'small', quantity: 1 },
      { productId: 'p1', variantId: 'large', quantity: 1 },
    ]);
    expect(merged).toHaveLength(2);
    expect(merged.map((i) => i.variantId)).toEqual(['small', 'large']);
  });

  it('normalises a missing variant to null rather than undefined', () => {
    const merged = mergeCartItems([{ productId: 'p1', quantity: 2 }]);
    expect(merged).toEqual([{ productId: 'p1', variantId: null, quantity: 2 }]);
  });

  it('treats a variant line and a plain line as different lines', () => {
    expect(cartLineKey({ productId: 'p1' })).not.toBe(
      cartLineKey({ productId: 'p1', variantId: 'v1' }),
    );
  });
});
