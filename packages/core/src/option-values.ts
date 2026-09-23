/**
 * Helpers for generating and reading variant VALUES.
 *
 * A product varies along one axis — see `Product.optionName` in the schema for
 * why — but that axis is free text, so "Colour" has always been as possible as
 * "Size". What was missing was anything to generate the values with: a merchant
 * typing a shoe in 38-45 entered eight rows by hand, and a merchant selling in
 * colours had no reason to think they could.
 *
 * Shared because both clients need it and for different halves: the app
 * GENERATES values from these, and the storefront READS them back to decide
 * whether a value can be drawn as a colour swatch.
 */

/**
 * Colours a merchant can pick from, as `[label, css]`.
 *
 * The css value is a real CSS colour, so a storefront can paint the swatch
 * without storing a hex anywhere — the variant keeps holding its NAME, which is
 * what a receipt, an order email and a WhatsApp message have to say. Adding a
 * hex column would have meant a migration to show a circle.
 */
export const COLOUR_CHOICES: ReadonlyArray<readonly [string, string]> = [
  ["Black", "#111111"],
  ["White", "#FFFFFF"],
  ["Ivory", "#FFFFF0"],
  ["Beige", "#F5F5DC"],
  ["Brown", "#8B5A2B"],
  ["Tan", "#D2B48C"],
  ["Red", "#E03131"],
  ["Maroon", "#800000"],
  ["Coral", "#FF7F50"],
  ["Orange", "#F76707"],
  ["Gold", "#D4AF37"],
  ["Yellow", "#FCC419"],
  ["Olive", "#808000"],
  ["Green", "#2F9E44"],
  ["Teal", "#087F8C"],
  ["Turquoise", "#40E0D0"],
  ["Sky Blue", "#74C0FC"],
  ["Royal Blue", "#4263EB"],
  ["Navy", "#1B2A4A"],
  ["Lavender", "#B197FC"],
  ["Purple", "#7048E8"],
  ["Pink", "#F783AC"],
  ["Silver", "#C0C0C0"],
  ["Grey", "#868E96"],
];

const BY_NAME = new Map(
  COLOUR_CHOICES.map(([label, css]) => [label.toLowerCase(), css]),
);

/**
 * The colour a variant value names, or null.
 *
 * Matched on the NAME rather than a stored hex, so it works on every product
 * that already exists. Null for anything unrecognised, which is the common case
 * — "Small", "5kg" — and the caller then renders the value as text, exactly as
 * before.
 */
export function colourOf(value: string | null | undefined): string | null {
  if (!value) return null;
  return BY_NAME.get(value.trim().toLowerCase()) ?? null;
}

/** Whether an option name reads as a colour axis, for deciding a swatch UI. */
export function isColourAxis(optionName: string | null | undefined): boolean {
  return /colou?r|shade/i.test(optionName ?? "");
}

/** Ready-made letter runs. Most clothing is one of these. */
export const SIZE_SCALES: ReadonlyArray<{ label: string; values: string[] }> = [
  { label: "S · M · L", values: ["S", "M", "L"] },
  { label: "XS → XXL", values: ["XS", "S", "M", "L", "XL", "XXL"] },
  { label: "UK 8 → 18", values: ["8", "10", "12", "14", "16", "18"] },
];

/**
 * Every value between two numbers, inclusive.
 *
 * Returns [] rather than throwing on anything unusable — a half-typed "from"
 * box should leave the button inert, not crash the form. Capped at 40 because
 * the write schema allows 30 variants and a merchant who typed 3 and 3000 by
 * accident should not get a spinner while the phone builds three thousand rows.
 */
export function numericRange(
  from: number,
  to: number,
  step = 1,
  suffix = "",
): string[] {
  if (!Number.isFinite(from) || !Number.isFinite(to)) return [];
  if (step <= 0) return [];

  const low = Math.min(from, to);
  const high = Math.max(from, to);
  if ((high - low) / step > 40) return [];

  const values: string[] = [];
  for (let n = low; n <= high + 1e-9; n += step) {
    // Trimmed so a 0.5 step gives "5.5" and a whole number gives "6", not "6.0".
    values.push(`${Number(n.toFixed(2))}${suffix}`);
  }
  return values;
}
