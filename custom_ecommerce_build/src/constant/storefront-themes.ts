import { StorefrontTheme } from '@core/enums';
import type { StorefrontLayout } from '@core/storefront/layout';
import {
  presetForTheme,
  resolveTokens,
  tokensToCssVars,
} from '@core/storefront/tokens';

/**
 * Storefront themes — the token sets behind `Tenant.theme`.
 *
 * ## What a theme is allowed to be
 *
 * A theme is a set of CSS custom properties plus a handful of structural flags.
 * It is NOT a second copy of the storefront. Every theme renders the same
 * markup, from the same components, against the same data, through the same
 * checkout — so a fix to the cart or the payment flow is verified once and
 * every store on every theme gets it. That property is the entire reason the
 * platform is one application instead of fifty, and a theme that needs its own
 * component tree has crossed the line and must not be merged.
 *
 * Concretely, a theme may change: image aspect ratio, grid density, corner
 * radius, card treatment, type scale and casing, spacing, and typeface. It may
 * not change: what data is fetched, what routes exist, what the checkout does,
 * or how money is handled.
 *
 * ## Why the tenant colour is still barely used
 *
 * Unchanged from the design brief, and worth restating because a theme makes it
 * tempting to spend more of it: `primaryColor` is one hex value we have no
 * control over and no review of. The storefront's own palette does the work and
 * the brand colour stays a controlled accent — buttons, the cart badge, a rule.
 * A theme that paints a full-bleed header in `var(--brand)` looks great for the
 * four tenants who picked a good colour and broken for the rest.
 *
 * ## On typefaces
 *
 * The brief recommended one typeface for all storefronts, on load cost. Each
 * theme has its own here, which is a deliberate departure: the faces are
 * declared with `preload: false` in the storefront layout, so a browser
 * downloads only the family its store's theme actually references. Per-store
 * cost is one family either way — the same as the recommendation — and the
 * extra `@font-face` blocks in the shared CSS are a few hundred bytes.
 * Reverse this if the Lighthouse mobile score on a seeded store drops below 90.
 */

export type StorefrontThemeConfig = {
  /** Operator-facing, shown in the onboarding form. */
  label: string;
  description: string;
  /** The kinds of business this was drawn for. Guidance, not enforcement. */
  suitedTo: string;

  /**
   * Applied to the storefront root as inline custom properties, exactly like
   * `--brand`. Consumed by the `st-*` classes in `globals.css`.
   */
  vars: Record<string, string>;

  /** Structural choices CSS cannot express on its own. */
  headerAlign: 'left' | 'center';
  /** Utility stores sell things people compare by part number. */
  showSku: boolean;
  /** A hairline of brand colour under the header. Off where it would shout. */
  brandRule: boolean;
  /**
   * Must match the theme's own column counts, or every image is fetched at the
   * wrong size — the single easiest way to lose the Lighthouse target.
   */
  gridImageSizes: string;
  detailImageSizes: string;
};

export const STOREFRONT_THEMES: Record<StorefrontTheme, StorefrontThemeConfig> =
  {
    [StorefrontTheme.CLASSIC]: {
      label: 'Classic',
      description:
        'Square imagery, balanced density, quiet neutral ground. The safe default and the one that flatters an inconsistent catalogue.',
      suitedTo: 'General retail, mixed catalogues, anything unphotographed',
      headerAlign: 'left',
      showSku: false,
      brandRule: false,
      gridImageSizes: '(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw',
      detailImageSizes: '(max-width: 768px) 100vw, 50vw',
      vars: {
        '--st-font': 'var(--font-st-classic)',
        '--st-product-aspect': '1 / 1',
        '--st-cols-sm': '2',
        '--st-cols-md': '3',
        '--st-cols-lg': '4',
        '--st-grid-gap': '1.5rem',
        '--st-radius': '0.5rem',
        '--st-radius-control': '0.375rem',
        '--st-card-border': '0px',
        '--st-card-border-color': 'transparent',
        '--st-card-bg': 'transparent',
        '--st-card-pad': '0px',
        '--st-image-bg': '#F3F4F6',
        '--st-name-size': '0.875rem',
        '--st-name-weight': '500',
        '--st-name-transform': 'none',
        '--st-name-tracking': '0',
        '--st-name-gap': '0.75rem',
        '--st-price-size': '0.875rem',
        '--st-price-weight': '400',
        '--st-price-color': '#4B5563',
        '--st-header-pad': '1rem',
        '--st-logo-height': '2rem',
        '--st-section-pad': '2.5rem',
      },
    },

    [StorefrontTheme.EDITORIAL]: {
      label: 'Editorial',
      description:
        'Tall portrait imagery, generous whitespace, tracked-out labels and a serif voice. Fewer products per row, each given room.',
      suitedTo: 'Clothing, jewellery, beauty, accessories',
      headerAlign: 'center',
      showSku: false,
      brandRule: false,
      gridImageSizes: '(max-width: 768px) 50vw, 33vw',
      detailImageSizes: '(max-width: 768px) 100vw, 50vw',
      vars: {
        '--st-font': 'var(--font-st-editorial)',
        // The one change that does the most work. A garment shot portrait and
        // cropped square loses the garment.
        '--st-product-aspect': '3 / 4',
        '--st-cols-sm': '2',
        '--st-cols-md': '2',
        '--st-cols-lg': '3',
        '--st-grid-gap': '2.5rem',
        '--st-radius': '0px',
        '--st-radius-control': '0px',
        '--st-card-border': '0px',
        '--st-card-border-color': 'transparent',
        '--st-card-bg': 'transparent',
        '--st-card-pad': '0px',
        '--st-image-bg': '#F6F4F1',
        '--st-name-size': '0.75rem',
        '--st-name-weight': '400',
        '--st-name-transform': 'uppercase',
        '--st-name-tracking': '0.08em',
        '--st-name-gap': '1rem',
        '--st-price-size': '0.8125rem',
        '--st-price-weight': '400',
        '--st-price-color': '#6B7280',
        '--st-header-pad': '1.75rem',
        '--st-logo-height': '2.25rem',
        '--st-section-pad': '4rem',
      },
    },

    [StorefrontTheme.UTILITY]: {
      label: 'Utility',
      description:
        'Dense bordered cards on white, a loud price, and part numbers on show. Built for a shopper comparing two things, not browsing.',
      suitedTo: 'Electronics, groceries, pharmacy, hardware, auto parts',
      headerAlign: 'left',
      showSku: true,
      brandRule: true,
      gridImageSizes: '(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw',
      detailImageSizes: '(max-width: 768px) 100vw, 50vw',
      vars: {
        '--st-font': 'var(--font-st-utility)',
        '--st-product-aspect': '1 / 1',
        '--st-cols-sm': '2',
        '--st-cols-md': '3',
        '--st-cols-lg': '4',
        '--st-grid-gap': '1rem',
        '--st-radius': '0.25rem',
        '--st-radius-control': '0.25rem',
        '--st-card-border': '1px',
        '--st-card-border-color': '#E5E7EB',
        '--st-card-bg': '#FFFFFF',
        '--st-card-pad': '0.75rem',
        // Hardware and groceries are photographed on white; a grey pad behind
        // them reads as a broken image rather than a product.
        '--st-image-bg': '#FFFFFF',
        '--st-name-size': '0.8125rem',
        '--st-name-weight': '500',
        '--st-name-transform': 'none',
        '--st-name-tracking': '0',
        '--st-name-gap': '0.625rem',
        // The price is the reason someone is on this page.
        '--st-price-size': '1rem',
        '--st-price-weight': '700',
        '--st-price-color': '#111827',
        '--st-header-pad': '0.75rem',
        '--st-logo-height': '1.75rem',
        '--st-section-pad': '1.5rem',
      },
    },
  };

/** Options for the operator's theme select, in the order they should read. */
export const STOREFRONT_THEME_OPTIONS = (
  Object.keys(STOREFRONT_THEMES) as StorefrontTheme[]
).map((value) => ({
  value,
  label: STOREFRONT_THEMES[value].label,
  description: STOREFRONT_THEMES[value].description,
  suitedTo: STOREFRONT_THEMES[value].suitedTo,
}));

/** Falls back to CLASSIC rather than throwing — a storefront must always render. */
export function themeConfig(
  theme: StorefrontTheme | null | undefined,
): StorefrontThemeConfig {
  return STOREFRONT_THEMES[theme ?? StorefrontTheme.CLASSIC];
}

/**
 * The custom properties for a storefront, as a style object for its root.
 *
 * Every visual decision a store makes arrives through this one function: the
 * preset's tokens, whatever the merchant overrode, and their brand colour. The
 * old per-theme `vars` blocks above are now only consulted for the handful of
 * structural flags CSS cannot express (`headerAlign`, `showSku`), and go away
 * when the header is rebuilt.
 */
export function storefrontStyle(
  layout: Pick<StorefrontLayout, 'preset' | 'tokens'> | null,
  theme: StorefrontTheme | null | undefined,
  primaryColor: string | null,
): React.CSSProperties {
  // A store with no layout yet still gets a preset — mapped from the theme it
  // chose at onboarding — so nothing renders unstyled while Phase 1 rolls out.
  const preset = layout?.preset ?? presetForTheme(theme);
  const tokens = resolveTokens(preset, {
    ...layout?.tokens,
    // The brand colour IS the accent unless the merchant set one explicitly.
    accent: layout?.tokens?.accent ?? primaryColor ?? undefined,
  });

  return tokensToCssVars(tokens, primaryColor) as React.CSSProperties;
}
