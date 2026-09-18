import { StorefrontTheme } from "../enums";
import { alpha, darken, ensureContrast, isHexColor, readableInk } from "./color";

/**
 * Storefront design tokens.
 *
 * The old theme system set about a dozen CSS variables and could only change
 * spacing, radius and typeface — which is why every store looked like the same
 * store in a different font. This widens that vocabulary to the roles a real
 * theme needs (a canvas colour distinct from a surface colour, a display face
 * distinct from a body face, motion timings) while keeping the property that
 * makes the platform work: it is still just custom properties on one element.
 * One stylesheet, one component tree, no per-tenant CSS.
 *
 * A merchant never edits these directly. They pick a PRESET and, at most,
 * override an accent colour, the media shape and the density. Everything else
 * is a designer's decision that a store owner should not have to make at 1am.
 */

/** Families the web app declares with `next/font`. */
export const FONT_KEYS = ["grotesk", "serif", "utility", "rounded"] as const;
export type FontKey = (typeof FONT_KEYS)[number];

export const MEDIA_RATIOS = ["3:4", "1:1", "4:3", "16:9"] as const;
export type MediaRatio = (typeof MEDIA_RATIOS)[number];

export const DENSITIES = ["compact", "balanced", "roomy"] as const;
export type Density = (typeof DENSITIES)[number];

export const PRESET_KEYS = ["momentum", "obsidian", "playful", "atelier"] as const;
export type PresetKey = (typeof PRESET_KEYS)[number];

export type StorefrontTokens = {
  color: {
    /** The page canvas. */
    bg: string;
    /** Cards, drawers, panels that sit on the canvas. */
    surface: string;
    ink: string;
    inkMuted: string;
    line: string;
    /** The one colour a merchant may replace. */
    accent: string;
    /** Urgency: a markdown, a last-one-left, a countdown running out. */
    sale: string;
    /**
     * Confirmation: the payment landed, the order is placed.
     *
     * Separate from `accent` on purpose. A shop whose accent is red or orange
     * would otherwise render its one unambiguously good moment in the colour
     * everything else uses for danger — and a shopper reads the colour before
     * the words. Green here is not decoration, it is the message.
     */
    success: string;
  };
  type: {
    display: FontKey;
    body: FontKey;
    /** Ratio between steps of the type scale. */
    scaleRatio: number;
    headingTransform: "none" | "uppercase";
    headingTracking: string;
    headingWeight: number;
  };
  shape: {
    radiusCard: string;
    radiusControl: string;
    radiusMedia: string;
    borderWidth: string;
  };
  layout: {
    density: Density;
    /** Max content width. Editorial themes run wider than utility ones. */
    container: string;
  };
  media: {
    ratio: MediaRatio;
    fit: "cover" | "contain";
  };
};

export type PresetDefinition = {
  key: PresetKey;
  /** Merchant-facing, shown in the app's preset picker. */
  label: string;
  description: string;
  suitedTo: string;
  tokens: StorefrontTokens;
};

/**
 * Four presets, each a complete point of view rather than a colour swap.
 *
 * They exist because "pick your fonts and colours" is a bad question to ask a
 * merchant who sells shoes. Picking the shop that looks like their shop is a
 * good one.
 */
export const PRESETS: Record<PresetKey, PresetDefinition> = {
  momentum: {
    key: "momentum",
    label: "Momentum",
    description:
      "Bright and energetic. Pill controls, bold numerals, room for badges and ranked bestsellers.",
    suitedTo: "Sportswear, sneakers, gear, anything with performance claims",
    tokens: {
      color: {
        bg: "#FFFFFF",
        surface: "#F4F5F1",
        ink: "#12130F",
        inkMuted: "#5C6057",
        line: "#E3E5DE",
        accent: "#C6F24E",
        sale: "#D93A2B",
        success: "#1F8A4C",
      },
      type: {
        display: "utility",
        body: "grotesk",
        scaleRatio: 1.25,
        headingTransform: "none",
        headingTracking: "-0.02em",
        headingWeight: 700,
      },
      shape: {
        radiusCard: "14px",
        radiusControl: "999px",
        radiusMedia: "14px",
        borderWidth: "0px",
      },
      layout: { density: "balanced", container: "1280px" },
      media: { ratio: "1:1", fit: "cover" },
    },
  },

  obsidian: {
    key: "obsidian",
    label: "Obsidian",
    description:
      "Dark canvas, wide uppercase display type, hard edges. Photography carries the page; the interface gets out of the way.",
    suitedTo: "Fashion, streetwear, jewellery, anything shot on a model",
    tokens: {
      color: {
        bg: "#0A0A0B",
        surface: "#141416",
        ink: "#F6F6F5",
        inkMuted: "#A3A3A1",
        line: "#26262A",
        accent: "#F6F6F5",
        sale: "#E0483A",
        success: "#3FBF7F",
      },
      type: {
        display: "utility",
        body: "grotesk",
        scaleRatio: 1.333,
        headingTransform: "uppercase",
        headingTracking: "0.04em",
        headingWeight: 600,
      },
      shape: {
        radiusCard: "0px",
        radiusControl: "0px",
        radiusMedia: "0px",
        borderWidth: "1px",
      },
      layout: { density: "roomy", container: "1440px" },
      media: { ratio: "3:4", fit: "cover" },
    },
  },

  playful: {
    key: "playful",
    label: "Playful",
    description:
      "Soft shapes, warm pastels, rounded type. Friendly rather than precious — built for browsing with a child next to you.",
    suitedTo: "Kids, toys, gifts, party supplies, stationery",
    tokens: {
      color: {
        bg: "#FFFDF8",
        surface: "#FFF1E2",
        ink: "#221C2E",
        inkMuted: "#6B6480",
        line: "#F0E3D3",
        accent: "#6D4AFF",
        sale: "#F4623A",
        success: "#12A150",
      },
      type: {
        display: "rounded",
        body: "rounded",
        scaleRatio: 1.2,
        headingTransform: "none",
        headingTracking: "-0.01em",
        headingWeight: 600,
      },
      shape: {
        radiusCard: "24px",
        radiusControl: "999px",
        radiusMedia: "24px",
        borderWidth: "0px",
      },
      layout: { density: "balanced", container: "1280px" },
      media: { ratio: "1:1", fit: "contain" },
    },
  },

  atelier: {
    key: "atelier",
    label: "Atelier",
    description:
      "Warm neutrals, serif headings, generous whitespace. Slow, considered, and flattering to a small catalogue.",
    suitedTo: "Luxury, tailoring, heritage brands, homeware",
    tokens: {
      color: {
        bg: "#FAF8F4",
        surface: "#F1EDE5",
        ink: "#1C1A17",
        inkMuted: "#6A6459",
        line: "#E2DCD1",
        accent: "#2F4434",
        sale: "#9C3B2E",
        success: "#4A7A52",
      },
      type: {
        display: "serif",
        body: "grotesk",
        scaleRatio: 1.3,
        headingTransform: "none",
        headingTracking: "-0.01em",
        headingWeight: 400,
      },
      shape: {
        radiusCard: "2px",
        radiusControl: "2px",
        radiusMedia: "0px",
        borderWidth: "1px",
      },
      layout: { density: "roomy", container: "1200px" },
      media: { ratio: "3:4", fit: "cover" },
    },
  },
};

export const PRESET_OPTIONS = PRESET_KEYS.map((key) => ({
  value: key,
  label: PRESETS[key].label,
  description: PRESETS[key].description,
  suitedTo: PRESETS[key].suitedTo,
}));

/**
 * What the old `Tenant.theme` becomes.
 *
 * Existing stores keep working and get a better-looking version of the
 * intention they already chose; they can pick any preset afterwards.
 */
const THEME_TO_PRESET: Record<StorefrontTheme, PresetKey> = {
  [StorefrontTheme.CLASSIC]: "momentum",
  [StorefrontTheme.EDITORIAL]: "atelier",
  [StorefrontTheme.UTILITY]: "momentum",
};

export function presetForTheme(theme: StorefrontTheme | null | undefined): PresetKey {
  return theme ? (THEME_TO_PRESET[theme] ?? "momentum") : "momentum";
}

/**
 * What a merchant may change on top of a preset. Everything else is ours.
 *
 * The TYPE lives here and its Zod schema lives in `./token-schema`, which is
 * not a tidiness split: this module is imported by the storefront shell to turn
 * a preset into CSS variables, so anything it imports is downloaded by every
 * shopper. Keeping the validator out of it takes Zod off the storefront
 * entirely — measured at ~60KB gzipped, on a page that validates nothing.
 */
export type TokenOverrides = {
  accent?: string | null;
  density?: Density;
  mediaRatio?: MediaRatio;
  mediaFit?: "cover" | "contain";
};

export function resolveTokens(
  preset: PresetKey,
  overrides: TokenOverrides = {},
): StorefrontTokens {
  const base = PRESETS[preset]?.tokens ?? PRESETS.momentum.tokens;
  const accent =
    overrides.accent && isHexColor(overrides.accent)
      ? // The merchant's colour, kept — but nudged until a label on it can be
        // read. See `ensureContrast`.
        ensureContrast(overrides.accent, base.color.bg, 3)
      : base.color.accent;

  return {
    ...base,
    color: { ...base.color, accent },
    layout: { ...base.layout, density: overrides.density ?? base.layout.density },
    media: {
      ratio: overrides.mediaRatio ?? base.media.ratio,
      fit: overrides.mediaFit ?? base.media.fit,
    },
  };
}

const DENSITY_SCALE: Record<Density, { sectionY: string; gap: string; cols: [number, number, number] }> =
  {
    compact: { sectionY: "2.5rem", gap: "1rem", cols: [2, 3, 5] },
    balanced: { sectionY: "4rem", gap: "1.5rem", cols: [2, 3, 4] },
    roomy: { sectionY: "6rem", gap: "2rem", cols: [2, 3, 3] },
  };

const RATIO_VALUE: Record<MediaRatio, string> = {
  "3:4": "3 / 4",
  "1:1": "1 / 1",
  "4:3": "4 / 3",
  "16:9": "16 / 9",
};

/**
 * Tokens as CSS custom properties for the storefront root element.
 *
 * Emits the new role-based names AND the `--st-*` names the current components
 * already consume, so this lands without rewriting every component in the same
 * change. The legacy block goes away as each component moves to the new names.
 */
export function tokensToCssVars(
  tokens: StorefrontTokens,
  brandColor?: string | null,
): Record<string, string> {
  const { color, type, shape, layout, media } = tokens;
  const density = DENSITY_SCALE[layout.density];
  const accentInk = readableInk(color.accent);
  const onDark = color.bg !== "#FFFFFF" && readableInk(color.bg) === "#FFFFFF";

  return {
    // ── Colour ────────────────────────────────────────────────────────────
    "--st-bg": color.bg,
    "--st-surface": color.surface,
    "--st-ink": color.ink,
    "--st-ink-muted": color.inkMuted,
    "--st-line": color.line,
    "--st-accent": color.accent,
    "--st-accent-ink": accentInk,
    "--st-accent-hover": darken(color.accent, onDark ? -0.1 : 0.12),
    "--st-accent-wash": alpha(color.accent, 0.12),
    "--st-sale": color.sale,
    "--st-success": color.success,
    // The soft ring behind a confirmation mark, and any success surface. Derived
    // rather than authored so it can never drift from the colour it tints.
    "--st-success-wash": alpha(color.success, 0.12),

    // ── Type ──────────────────────────────────────────────────────────────
    "--st-font-display": `var(--font-st-${type.display})`,
    "--st-font-body": `var(--font-st-${type.body})`,
    "--st-scale-ratio": String(type.scaleRatio),
    "--st-heading-transform": type.headingTransform,
    "--st-heading-tracking": type.headingTracking,
    "--st-heading-weight": String(type.headingWeight),

    // ── Shape ─────────────────────────────────────────────────────────────
    "--st-radius-card": shape.radiusCard,
    "--st-radius-control": shape.radiusControl,
    "--st-radius-media": shape.radiusMedia,
    "--st-border-width": shape.borderWidth,

    // ── Layout ────────────────────────────────────────────────────────────
    "--st-container": layout.container,
    "--st-section-y": density.sectionY,
    "--st-gap": density.gap,

    // ── Media ─────────────────────────────────────────────────────────────
    "--st-media-ratio": RATIO_VALUE[media.ratio],
    "--st-media-fit": media.fit,

    // ── Motion (Part 5 of the design plan) ───────────────────────────────
    "--st-ease": "cubic-bezier(0.16, 1, 0.3, 1)",
    "--st-duration-fast": "180ms",
    "--st-duration": "420ms",
    "--st-duration-slow": "700ms",
    "--st-stagger": "60ms",
    "--st-reveal-distance": "16px",

    // ── Legacy names, still read by the existing components ───────────────
    "--brand": brandColor ?? color.accent,
    "--st-font": `var(--font-st-${type.body})`,
    "--st-product-aspect": RATIO_VALUE[media.ratio],
    "--st-cols-sm": String(density.cols[0]),
    "--st-cols-md": String(density.cols[1]),
    "--st-cols-lg": String(density.cols[2]),
    "--st-grid-gap": density.gap,
    "--st-radius": shape.radiusCard,
    "--st-card-border": shape.borderWidth,
    "--st-card-border-color": color.line,
    "--st-card-bg": "transparent",
    "--st-card-pad": "0px",
    "--st-image-bg": color.surface,
    "--st-name-size": "0.9375rem",
    "--st-name-weight": "500",
    "--st-name-transform": type.headingTransform === "uppercase" ? "uppercase" : "none",
    "--st-name-tracking": type.headingTransform === "uppercase" ? "0.04em" : "0",
    "--st-name-gap": "0.75rem",
    "--st-price-size": "0.875rem",
    "--st-price-weight": "500",
    "--st-price-color": color.inkMuted,
    "--st-header-pad": "1rem",
    "--st-logo-height": "2rem",
    "--st-section-pad": density.sectionY,
  };
}
