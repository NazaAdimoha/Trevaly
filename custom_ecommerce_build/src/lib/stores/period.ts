/**
 * The windows the dashboard and the app can ask for.
 *
 * Deliberately three, not a date picker. A merchant checking their phone wants
 * "this week" or "this month"; anyone who needs an arbitrary range is doing
 * accounting, and that belongs on the web with a keyboard.
 */
export const PERIODS = ['week', 'month', 'all', 'custom'] as const;
export type Period = (typeof PERIODS)[number];

export function parsePeriod(value: string | null | undefined): Period {
  return PERIODS.includes(value as Period) ? (value as Period) : 'week';
}

export type Window = {
  from: Date | null;
  to: Date | null;
  previousFrom: Date | null;
  previousTo: Date | null;
};

/**
 * Parse an explicit `from`/`to` pair.
 *
 * Returns null unless BOTH parse and the range is the right way round — a
 * half-specified or inverted range silently returning "everything" would show a
 * merchant the wrong total under a date label they chose themselves, which is
 * worse than ignoring the filter.
 *
 * `to` is pushed to the end of its day so a range of "2 Sep – 2 Sep" means that
 * whole day rather than an empty instant at midnight.
 */
export function parseRange(
  fromRaw: string | null | undefined,
  toRaw: string | null | undefined,
): { from: Date; to: Date } | null {
  if (!fromRaw || !toRaw) return null;

  const from = new Date(fromRaw);
  const to = new Date(toRaw);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return null;

  const end = new Date(to);
  if (end.getUTCHours() === 0 && end.getUTCMinutes() === 0) {
    end.setUTCHours(23, 59, 59, 999);
  }
  if (end <= from) return null;

  // A range longer than two years is almost always a typo in a date field, and
  // it makes the comparison window meaningless.
  if (end.getTime() - from.getTime() > 2 * 365 * 24 * 60 * 60 * 1000) return null;

  return { from, to: end };
}

/**
 * The current window and the equally-long one before it.
 *
 * Both are returned together because a delta is only meaningful against a
 * window of the same length — comparing this week against all of last month
 * produces a number that looks like a collapse every Monday.
 *
 * `all` has no bounds and therefore no comparison, which is why `from` is
 * nullable rather than a date far in the past.
 */
export function windowFor(
  period: Period,
  now = new Date(),
  custom?: { from: Date; to: Date } | null,
): Window {
  // An explicit range wins. Its comparison window is the same number of days
  // immediately before it, so "1–7 Sep vs the 7 days before" holds however
  // unusual the range the merchant picked.
  if (custom) {
    const span = custom.to.getTime() - custom.from.getTime();
    return {
      from: custom.from,
      to: custom.to,
      previousFrom: new Date(custom.from.getTime() - span),
      previousTo: custom.from,
    };
  }

  if (period === 'all' || period === 'custom') {
    // `custom` without a valid range degrades to unbounded rather than erroring.
    return { from: null, to: null, previousFrom: null, previousTo: null };
  }

  const days = period === 'week' ? 7 : 30;
  const ms = days * 24 * 60 * 60 * 1000;

  return {
    from: new Date(now.getTime() - ms),
    to: now,
    previousFrom: new Date(now.getTime() - ms * 2),
    previousTo: new Date(now.getTime() - ms),
  };
}

/**
 * Percentage change, or null when there is nothing to compare against.
 *
 * Returning 0 for "no previous data" would tell a store that opened on Monday
 * it is flat, which is worse than telling it nothing.
 */
export function deltaPercent(
  current: number,
  previous: number,
): number | null {
  if (previous === 0) return current === 0 ? null : 100;
  return Math.round(((current - previous) / previous) * 100);
}
