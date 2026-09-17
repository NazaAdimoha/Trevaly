import { describe, expect, it } from 'vitest';

import {
  deltaPercent,
  parsePeriod,
  parseRange,
  windowFor,
} from './period';

describe('parsePeriod', () => {
  it.each(['week', 'month', 'all'] as const)('accepts %s', (p) => {
    expect(parsePeriod(p)).toBe(p);
  });

  it.each([null, undefined, '', 'yesterday', 'WEEK'])(
    'falls back to week for %p rather than erroring',
    (input) => {
      expect(parsePeriod(input)).toBe('week');
    },
  );
});

describe('windowFor', () => {
  const now = new Date('2026-09-02T12:00:00Z');

  it('gives a week and the week before it', () => {
    const { from, previousFrom } = windowFor('week', now);
    expect(from?.toISOString()).toBe('2026-08-26T12:00:00.000Z');
    expect(previousFrom?.toISOString()).toBe('2026-08-19T12:00:00.000Z');
  });

  // The comparison window must be the SAME LENGTH, or every Monday looks like
  // a collapse.
  it('makes both windows equal length', () => {
    const { from, previousFrom } = windowFor('month', now);
    // Asserting rather than `!`: if these are ever null the failure should name
    // that, not throw an unreadable TypeError three lines later.
    expect(from).toBeInstanceOf(Date);
    expect(previousFrom).toBeInstanceOf(Date);
    if (!from || !previousFrom) return;

    expect(from.getTime() - previousFrom.getTime()).toBe(
      now.getTime() - from.getTime(),
    );
  });

  it('gives "all" no bounds, so it has no comparison', () => {
    expect(windowFor('all', now)).toEqual({
      from: null,
      to: null,
      previousFrom: null,
      previousTo: null,
    });
  });
});

describe('deltaPercent', () => {
  it('computes growth', () => {
    expect(deltaPercent(150, 100)).toBe(50);
  });

  it('computes a fall', () => {
    expect(deltaPercent(50, 100)).toBe(-50);
  });

  // Regression: returning 0 here tells a store that opened on Monday it is
  // flat, which is worse than telling it nothing at all.
  it('returns null when there is nothing to compare against', () => {
    expect(deltaPercent(0, 0)).toBeNull();
  });

  it('treats growth from zero as 100%, not infinity', () => {
    expect(deltaPercent(9_000, 0)).toBe(100);
  });
});

describe('parseRange', () => {
  it('accepts a valid range and extends "to" to end of day', () => {
    const r = parseRange('2026-09-01', '2026-09-02');
    expect(r?.from.toISOString()).toBe('2026-09-01T00:00:00.000Z');
    expect(r?.to.toISOString()).toBe('2026-09-02T23:59:59.999Z');
  });

  // A half-specified or inverted range must not silently mean "everything" —
  // that shows a merchant the wrong total under a label they chose.
  it.each([
    ['only from', '2026-09-01', null],
    ['only to', null, '2026-09-02'],
    ['inverted', '2026-09-05', '2026-09-01'],
    ['zero-length mid-day', '2026-09-01T14:00:00Z', '2026-09-01T14:00:00Z'],
    ['nonsense', 'not-a-date', '2026-09-02'],
  ])('rejects %s', (_label, from, to) => {
    expect(parseRange(from, to)).toBeNull();
  });

  // Picking one day in a date picker sends the same date twice; it must mean
  // that whole day rather than an empty instant at midnight.
  it('treats a single picked day as that whole day', () => {
    const r = parseRange('2026-09-01', '2026-09-01');
    expect(r?.to.toISOString()).toBe('2026-09-01T23:59:59.999Z');
  });

  it('rejects an absurdly long range', () => {
    expect(parseRange('2000-01-01', '2026-01-01')).toBeNull();
  });
});

describe('windowFor with a custom range', () => {
  it('compares against the same number of days immediately before', () => {
    const custom = parseRange('2026-09-01', '2026-09-07');
    expect(custom).not.toBeNull();
    if (!custom) return;

    const w = windowFor('custom', new Date('2026-09-08'), custom);
    const { from, to, previousFrom, previousTo } = w;
    if (!from || !to || !previousFrom || !previousTo) {
      throw new Error('a custom window must be fully bounded');
    }

    expect(previousTo.getTime() - previousFrom.getTime()).toBe(
      to.getTime() - from.getTime(),
    );
    expect(previousTo).toEqual(from);
  });

  it('degrades to unbounded when custom is asked for without a valid range', () => {
    expect(windowFor('custom', new Date(), null)).toEqual({
      from: null,
      to: null,
      previousFrom: null,
      previousTo: null,
    });
  });
});
