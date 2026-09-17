import { format, isValid, parseISO, subYears } from 'date-fns';

export { cn } from './cn';

export const DOB_MAX_YEAR = subYears(new Date(), 18);

export const DATE_FORMATS = {
  /** 12-08-2025 */
  DISPLAY: 'dd-MM-yyyy',
  /** Apr 12, 2025 */
  DISPLAY_SHORT: 'MMM dd, yyyy',
  /** April 12, 2025 */
  DISPLAY_LONG: 'MMMM dd, yyyy',
  /** 12 Apr 2025 */
  DISPLAY_DAY_MONTH: 'dd MMM yyyy',
  /** 2025-08-12 */
  ISO_DATE: 'yyyy-MM-dd',
  /** 12/08/2025 */
  SLASH: 'dd/MM/yyyy',
  /** Apr 12, 2025 10:30 AM */
  DISPLAY_WITH_TIME: 'MMM dd, yyyy hh:mm a',
  /** 2025-08-12T10:30:00 */
  ISO_DATETIME: "yyyy-MM-dd'T'HH:mm:ss",
} as const;

export type DateFormat = (typeof DATE_FORMATS)[keyof typeof DATE_FORMATS];

export function formatDate(
  date: Date | string | null | undefined,
  dateFormat: DateFormat = DATE_FORMATS.DISPLAY,
): string {
  if (!date) return '—';
  const parsed = typeof date === 'string' ? parseISO(date) : date;
  if (!isValid(parsed)) return '—';
  return format(parsed, dateFormat);
}

/**
 * Money formatting now lives in the shared core so the mobile app renders a
 * naira figure identically. Re-exported here rather than moved outright: every
 * call site already imports it from `@/lib/utils`, and one source of truth
 * matters more than one import path.
 */
export {
  formatCurrency,
  type FormatCurrencyOptions,
  formatScaled,
  normalizeCurrencyCode,
  toMajor,
  toMinor,
  toMinorOrNull,
} from '@core/money';

export function humanizeEnumValue(value: string): string {
  return value
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function labelFromOptions<T extends string>(
  options: ReadonlyArray<{ label: string; value: T }>,
  value: string | null | undefined,
  fallback: 'raw' | 'humanized' = 'raw',
): string {
  if (!value) return '—';

  const matched = options.find((option) => option.value === (value as T));
  if (matched) return matched.label;

  return fallback === 'humanized' ? humanizeEnumValue(value) : value;
}

export function formatPercent(
  value: number | null | undefined,
  suffix = '%',
): string {
  if (value == null) return '—';
  return `${parseFloat((value * 100).toFixed(10))}${suffix}`;
}

export function formatCount(
  value: number | null | undefined,
  locale = 'en-US',
): string {
  if (value == null) return '—';
  return new Intl.NumberFormat(locale).format(value);
}
