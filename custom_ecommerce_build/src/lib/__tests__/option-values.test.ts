import { describe, expect, it } from 'vitest';

import { colourOf, isColourAxis, numericRange, SIZE_SCALES } from '@core/option-values';

/**
 * The generators behind the app's option editor.
 *
 * Worth unit-testing rather than only exercising through the phone: a merchant
 * typing "38 to 45" gets eight rows they then price and count individually, so
 * an off-by-one here is eight wrong records, and the bounds are what stop a
 * mistyped range from building thousands.
 */
describe('numericRange', () => {
  it('is inclusive of both ends', () => {
    expect(numericRange(38, 45)).toEqual(['38', '39', '40', '41', '42', '43', '44', '45']);
  });

  it('does not care which way round the merchant typed it', () => {
    expect(numericRange(45, 38)).toEqual(numericRange(38, 45));
  });

  it('gives a single value when both ends match', () => {
    expect(numericRange(40, 40)).toEqual(['40']);
  });

  it('carries a unit, for weights', () => {
    expect(numericRange(1, 3, 1, 'kg')).toEqual(['1kg', '2kg', '3kg']);
  });

  it('keeps fractional steps readable', () => {
    // Not "5.0" and not "5.500000000000001".
    expect(numericRange(5, 6.5, 0.5)).toEqual(['5', '5.5', '6', '6.5']);
  });

  it('refuses a range too large to be meant, rather than building it', () => {
    // The write schema allows 30 variants; a mistyped 3 to 3000 must not spin
    // the phone up building three thousand rows to then be rejected.
    expect(numericRange(3, 3000)).toEqual([]);
  });

  it('is inert on half-typed or nonsensical input', () => {
    expect(numericRange(Number.NaN, 10)).toEqual([]);
    expect(numericRange(1, 10, 0)).toEqual([]);
  });
});

describe('colourOf', () => {
  it('resolves a colour the picker offers, whatever the case', () => {
    expect(colourOf('Navy')).toBe('#1B2A4A');
    expect(colourOf('  navy ')).toBe('#1B2A4A');
    expect(colourOf('ROYAL BLUE')).toBe('#4263EB');
  });

  it('is null for a value that is not a colour, so the caller renders text', () => {
    expect(colourOf('Small')).toBeNull();
    expect(colourOf('5kg')).toBeNull();
    expect(colourOf('')).toBeNull();
    expect(colourOf(null)).toBeNull();
  });
});

describe('isColourAxis', () => {
  it('accepts both spellings and a synonym', () => {
    expect(isColourAxis('Colour')).toBe(true);
    expect(isColourAxis('color')).toBe(true);
    expect(isColourAxis('Shade')).toBe(true);
  });

  it('rejects the other axes', () => {
    expect(isColourAxis('Size')).toBe(false);
    expect(isColourAxis('Weight')).toBe(false);
    expect(isColourAxis(null)).toBe(false);
  });
});

describe('SIZE_SCALES', () => {
  it('has no duplicates within a scale, which the API would reject', () => {
    for (const scale of SIZE_SCALES) {
      expect(new Set(scale.values).size, scale.label).toBe(scale.values.length);
    }
  });

  it('stays inside the 30-variant limit', () => {
    for (const scale of SIZE_SCALES) {
      expect(scale.values.length, scale.label).toBeLessThanOrEqual(30);
    }
  });
});
