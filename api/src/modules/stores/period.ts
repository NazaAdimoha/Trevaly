/**
 * The windows the dashboard and the app can ask for. Ported unchanged from
 * web's `lib/stores/period.ts`.
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
 * Parse an explicit `from`/`to` pair. Null unless BOTH parse and the range is
 * the right way round; `to` is pushed to the end of its day; ranges over two
 * years are rejected as typos.
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
  if (end.getTime() - from.getTime() > 2 * 365 * 24 * 60 * 60 * 1000) return null;

  return { from, to: end };
}

/** The current window and the equally long one before it. */
export function windowFor(
  period: Period,
  now = new Date(),
  custom?: { from: Date; to: Date } | null,
): Window {
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

/** Percentage change, or null when there is nothing to compare against. */
export function deltaPercent(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? null : 100;
  return Math.round(((current - previous) / previous) * 100);
}
