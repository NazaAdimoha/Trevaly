/**
 * Money and number formatting.
 *
 * Shared with the mobile app: every price a merchant or a shopper sees is
 * rendered by this, on both clients, so a naira figure cannot be formatted one
 * way on the web and another on a phone.
 *
 * Money is integer kobo everywhere in the system. `toMinor`/`toMajor` are the
 * only sanctioned conversion — never multiply by 100 inline.
 */

export function toMajor(minorAmount: number | string, factor = 100): number {
  return Number(minorAmount) / factor;
}

export function formatScaled(value: number, scale: number): string {
  const safeScale = scale > 0 ? scale : 1;
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 6,
    minimumFractionDigits: 0,
  }).format(value / safeScale);
}

export function toMinor(majorAmount: number | string, factor = 100): number {
  return Math.round(Number(majorAmount) * factor);
}

export function toMinorOrNull(
  majorAmount: number | string | null | undefined,
  factor = 100,
): number | null {
  if (majorAmount == null || majorAmount === "") return null;
  return toMinor(majorAmount, factor);
}

export interface FormatCurrencyOptions {
  currency?: string | null;
  locale?: string;
  fromMinor?: boolean;
  minorFactor?: number;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
}

const ISO_CURRENCY_CODE_REGEX = /^[A-Z]{3}$/;

export function normalizeCurrencyCode(
  currency: string | null | undefined,
): string | undefined {
  if (!currency) return undefined;

  const normalized = currency.trim().toUpperCase();
  if (!ISO_CURRENCY_CODE_REGEX.test(normalized)) return undefined;

  return normalized;
}

export function formatCurrency(
  amount: number | null | undefined,
  options: FormatCurrencyOptions = {},
): string {
  if (amount == null) return "—";

  const {
    currency = "NGN",
    locale = "en-NG",
    fromMinor = true,
    minorFactor = 100,
    minimumFractionDigits = 2,
    maximumFractionDigits = 2,
  } = options;

  const value = fromMinor ? toMajor(amount, minorFactor) : amount;

  const normalizedCurrency = normalizeCurrencyCode(currency);

  if (!normalizedCurrency) {
    return new Intl.NumberFormat(locale, {
      style: "decimal",
      minimumFractionDigits,
      maximumFractionDigits,
    }).format(value);
  }

  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: normalizedCurrency,
      minimumFractionDigits,
      maximumFractionDigits,
    }).format(value);
  } catch {
    return new Intl.NumberFormat(locale, {
      style: "decimal",
      minimumFractionDigits,
      maximumFractionDigits,
    }).format(value);
  }
}
