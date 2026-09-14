/**
 * Design tokens, ported by VALUE from the web app's `@theme` block.
 *
 * Not by class — Tailwind does not exist here. These are the same greens the
 * dashboard sidebar and the marketing site use, so a merchant moving between
 * the phone and the browser sees one product rather than two.
 *
 * Kept in the mobile app rather than `packages/core` on purpose: the core is
 * platform-free, and a palette shaped for React Native's style objects is a
 * platform detail. The values are the shared thing, not the shape.
 */
export const color = {
  // Forest — the sidebar gradient's stops.
  forest900: '#0F2518',
  forest800: '#1A3828',
  forest700: '#1E4330',
  forest600: '#27603F',

  primary: '#4DBF7D',
  primary700: '#337F53',
  primary400: '#6BCA93',
  primary200: '#A6DFBE',
  primary50: '#DBF2E5',

  ink: '#0F2518',
  body: '#4A554E',
  muted: '#7C8580',

  surface: '#FFFFFF',
  ground: '#F8F7F4',
  sunk: '#F2F1EC',
  line: '#E4E2DB',
  lineSoft: '#EEECE6',

  // Semantic, from the web badge palette. Separate from the brand accent.
  success: '#04802E',
  successBg: '#E7F6EC',
  warning: '#AD6F07',
  warningBg: '#FEF6E7',
  danger: '#D42620',
  dangerBg: '#FBEAE9',
  info: '#006CE0',
  infoBg: '#E8F1FB',
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 4,
  md: 8,
  lg: 10,
  pill: 999,
} as const;

/**
 * Type scale, matched to the reference app.
 *
 * Poppins throughout — a geometric sans with round bowls and open counters,
 * which is what gives that app its friendly, un-corporate feel. The alternative
 * was the system face, and San Francisco reads as "iOS settings screen" no
 * matter what you do with it.
 *
 * The weight is baked into the family name, not set with `fontWeight`. React
 * Native on Android ignores numeric weights for a custom family and silently
 * renders regular — the single most common way a carefully-specified type scale
 * arrives flat on half the devices.
 */
export const font = {
  regular: 'Poppins_400Regular',
  medium: 'Poppins_500Medium',
  semibold: 'Poppins_600SemiBold',
  bold: 'Poppins_700Bold',
} as const;

export const text = {
  /** Screen title — "Products", "Campaigns". */
  display: { fontFamily: font.bold, fontSize: 26, letterSpacing: -0.4 },
  /** A figure that is the point of its card: a balance, a stat. */
  figure: { fontFamily: font.bold, fontSize: 30, letterSpacing: -0.6 },
  title: { fontFamily: font.semibold, fontSize: 20, letterSpacing: -0.2 },
  heading: { fontFamily: font.semibold, fontSize: 17 },
  /** Row labels in a settings list. Deliberately regular, not medium — a list
   *  of fifteen semibold rows is a list with no hierarchy at all. */
  body: { fontFamily: font.regular, fontSize: 16 },
  small: { fontFamily: font.regular, fontSize: 13.5 },
  /** Section captions: SALES & MARKETING. Tracking is what makes small
   *  uppercase readable rather than a smear. */
  label: { fontFamily: font.bold, fontSize: 12, letterSpacing: 1.1 },
} as const;

/**
 * Depth.
 *
 * Two shadows per level, not one: a tight, darker contact shadow that sits the
 * card on the surface, and a wide, softer ambient shadow that gives it height.
 * A single blurred shadow reads as a smudge — the pair is what makes the edge
 * look lifted. React Native only composites one shadow per view, so `raised`
 * goes on the card and `contact` on a wrapper when both are wanted.
 *
 * Shadows are tinted with the forest ink rather than pure black. On the warm
 * `ground` a black shadow greys the surrounding paper; a hue-matched one keeps
 * the whole screen in the same light.
 *
 * `elevation` is the Android half and is not optional — without it a card that
 * looks lifted on iOS is completely flat on Android, which is half the market.
 */
export const shadow = {
  contact: {
    shadowColor: color.forest900,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  raised: {
    shadowColor: color.forest900,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  lifted: {
    shadowColor: color.forest900,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 10,
  },
} as const;

/** Minimum touch target. Never ship a control smaller than this. */
export const HIT = 44;
