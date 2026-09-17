/**
 * Colour arithmetic for storefront theming.
 *
 * A merchant picks one accent — from their logo or a colour wheel — and it then
 * has to sit under white text on a button, beside body copy, and behind a cart
 * badge. Left unchecked, a pale yellow accent produces an invisible button and
 * a dark navy one produces an unreadable badge. These helpers decide what is
 * legible rather than hoping.
 *
 * Deliberately dependency-free (the core is shared with the Expo app) and pure,
 * so the same answer comes out on the server, in the browser and on a phone.
 */

export type Rgb = { r: number; g: number; b: number };

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

export function isHexColor(value: string): boolean {
  return HEX.test(value.trim());
}

export function hexToRgb(hex: string): Rgb | null {
  const value = hex.trim();
  if (!HEX.test(value)) return null;

  const digits =
    value.length === 4
      ? value
          .slice(1)
          .split('')
          .map((d) => d + d)
          .join('')
      : value.slice(1);

  return {
    r: parseInt(digits.slice(0, 2), 16),
    g: parseInt(digits.slice(2, 4), 16),
    b: parseInt(digits.slice(4, 6), 16),
  };
}

export function rgbToHex({ r, g, b }: Rgb): string {
  const part = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, '0');
  return `#${part(r)}${part(g)}${part(b)}`;
}

/** WCAG relative luminance. */
export function luminance(color: Rgb): number {
  const channel = (value: number) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b);
}

/** WCAG contrast ratio, 1 (identical) to 21 (black on white). */
export function contrastRatio(a: string, b: string): number {
  const first = hexToRgb(a);
  const second = hexToRgb(b);
  if (!first || !second) return 1;

  const light = Math.max(luminance(first), luminance(second));
  const dark = Math.min(luminance(first), luminance(second));
  return (light + 0.05) / (dark + 0.05);
}

/**
 * Black or white, whichever is readable ON this colour.
 *
 * Used for button labels and badge text, where the merchant chose the
 * background and we choose the foreground.
 */
export function readableInk(background: string, dark = '#111111', light = '#FFFFFF'): string {
  return contrastRatio(background, dark) >= contrastRatio(background, light) ? dark : light;
}

function mix(color: Rgb, target: Rgb, amount: number): Rgb {
  return {
    r: color.r + (target.r - color.r) * amount,
    g: color.g + (target.g - color.g) * amount,
    b: color.b + (target.b - color.b) * amount,
  };
}

export function darken(hex: string, amount: number): string {
  const rgb = hexToRgb(hex);
  return rgb ? rgbToHex(mix(rgb, { r: 0, g: 0, b: 0 }, amount)) : hex;
}

export function lighten(hex: string, amount: number): string {
  const rgb = hexToRgb(hex);
  return rgb ? rgbToHex(mix(rgb, { r: 255, g: 255, b: 255 }, amount)) : hex;
}

/** A translucent version, for hover washes and focus rings. */
export function alpha(hex: string, opacity: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const clamped = Math.max(0, Math.min(1, opacity));
  return `rgba(${Math.round(rgb.r)}, ${Math.round(rgb.g)}, ${Math.round(rgb.b)}, ${clamped})`;
}

/**
 * Nudge a colour until it is legible against `against`, keeping its hue.
 *
 * This is what lets a merchant keep the brand colour they care about: we do not
 * replace their teal with a different teal, we darken or lighten it in steps
 * until text on it can actually be read, and stop at the first shade that
 * passes. `minRatio` defaults to 3:1 — the WCAG threshold for large text and UI
 * components, which is what an accent is used for. Pass 4.5 for body copy.
 */
export function ensureContrast(color: string, against: string, minRatio = 3): string {
  if (!isHexColor(color) || !isHexColor(against)) return color;
  if (contrastRatio(color, against) >= minRatio) return color;

  const backgroundIsLight = (luminance(hexToRgb(against)!) ?? 0) > 0.4;
  const shift = backgroundIsLight ? darken : lighten;

  let candidate = color;
  for (let step = 1; step <= 20; step++) {
    candidate = shift(color, step * 0.05);
    if (contrastRatio(candidate, against) >= minRatio) return candidate;
  }
  // Nothing in this hue works; fall back to something that certainly does.
  return backgroundIsLight ? '#111111' : '#FFFFFF';
}

/**
 * Pick the accent to propose from a logo's dominant colours.
 *
 * Cloudinary returns these ordered by coverage, which is usually the wrong
 * order for an accent: the most common colour in a logo is typically its
 * background. Prefer the most saturated colour that can carry text, so a
 * black-and-red logo proposes the red, not the black.
 */
export function proposeAccent(
  candidates: string[],
  surface: string,
  fallback: string,
): string {
  const scored = candidates
    .filter(isHexColor)
    .map((hex) => {
      const rgb = hexToRgb(hex)!;
      const max = Math.max(rgb.r, rgb.g, rgb.b);
      const min = Math.min(rgb.r, rgb.g, rgb.b);
      const saturation = max === 0 ? 0 : (max - min) / max;
      return { hex, saturation, contrast: contrastRatio(hex, surface) };
    })
    // Near-greys make weak accents, and anything invisible on the surface is
    // not a candidate at all.
    .filter((c) => c.saturation > 0.25 && c.contrast >= 2)
    .sort((a, b) => b.saturation - a.saturation);

  const winner = scored[0]?.hex ?? fallback;
  return ensureContrast(winner, surface, 3);
}
