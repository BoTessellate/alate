/**
 * Design System - Theme Constants
 * Alate - Design System
 */

// =============================================================================
// FONT FAMILIES — two faces, four weights.
// =============================================================================
// The app uses two faces:
//   - `primary*`: DM Sans (Google Fonts, OFL). Geometric humanist
//     sans-serif. Replaces the platform system serif (May 2 2026)
//     because the system serif rendered inconsistently across phones
//     and read clinical against the Viaoda Libre display headings.
//     Loaded as four discrete weight files (Regular / Medium /
//     SemiBold / Bold) bundled via `useFonts` in App.tsx.
//
//     Why four named tokens instead of one + fontWeight: RN Android's
//     font weight resolver only walks within a single family, but DM
//     Sans static ttfs split Medium and SemiBold into their own
//     families per the name table (`'DM Sans Medium'`, `'DM Sans
//     SemiBold'`) — so `fontFamily: 'DM Sans' + fontWeight: '500'`
//     silently falls back to Regular or Bold. Solution: name each
//     weight by its expo-font key (matches its file basename + ttf
//     PostScript name) and pick the right token per role.
//
//   - `display`: Viaoda Libre (Google Fonts, OFL). Bundled via
//     `useFonts` in App.tsx. Used for page titles + hero verses.
//     Family name MUST be the exact string the ttf's name table
//     reports for NameID 1, including the space — see anti-pattern
//     #12 in `project_anti_patterns.md`.
//
// History: prior to May 2 2026 `primary` was `'serif'` (system serif).
// Earlier still, the registry also exported `accent` (Georgia), `mono`
// (system monospace), `fallback` (duplicate of primary), and
// `displayLegacy` (DM Serif Display Italic — ttf deleted when we
// moved to Viaoda Libre). None had any callsites; all were dropped
// April 29 2026. Adding a new face needs an explicit reason.
// May 3 2026 trial: collapse to a single typeface across the entire
// app (Marcellus). Single-weight serif — every token points at the
// same file. Bold/medium tokens stay in the registry so callers don't
// have to change, but the rendered face is identical; visual hierarchy
// has to come from size + colour + spacing instead of weight. Revert
// to the prior DM Sans + Viaoda setup if the uniform weight reads flat.
export const fontFamily = {
  primary: 'Marcellus-Regular',
  primaryMedium: 'Marcellus-Regular',
  primarySemiBold: 'Marcellus-Regular',
  primaryBold: 'Marcellus-Regular',
  display: 'Marcellus-Regular',
};

// Shared heading trait: every display/heading token mixes this in so
// the serif display face stays consistent across the app.
//
// CRITICAL: heading tokens MUST NOT set `fontWeight: '700'` (or any
// non-400 weight). Viaoda Libre is shipped as Regular only — when
// styles request weight 700, Android's font manager fails the lookup
// (no `ViaodaLibre-Regular_bold.ttf` exists) and silently falls back
// to the system serif Bold (Noto Serif Bold), which produced the
// "headings render in plain serif bold, not Viaoda Libre" regression
// of April 29 2026 (~5 install cycles spent chasing it). Keep all
// heading tokens at `fontWeight: '400'`. The Viaoda Libre face has
// enough display character on its own; synthetic bold is a trap.
//
// History: earlier versions forced `textTransform: 'lowercase'` for
// an editorial feel, but the user moved to title-case page headings
// (April 29 2026 — "Camel case page headings"). Whatever case the
// source string uses is what renders. Page titles in title case;
// poetic / phrase headings in sentence case.
// Headings now render in Marcellus too (May 3 2026 trial — single
// typeface across the whole app). Same single-weight constraint
// (Marcellus is Regular-only) so heading tokens stay at
// fontWeight: '400'; visual hierarchy comes from size + spacing.
const headingSerif = {
  fontFamily: fontFamily.display,
};

// =============================================================================
// COLOR PALETTE - Grey-Purple system (per Claude Design handoff)
// Background:     #e6e4e9  (solid, lightest stop of the tonal scale)
// Primary brand:  #6a5f75  (grey-purple — quieter than the old saturated purple)
// Semantic:       dusty sage / terracotta / clay red / slate blue (all muted)
// Source:         alate-design-system/project/colors_and_type.css
// =============================================================================
export const colors = {
  // Primary - Grey-purple brand colour
  primary: '#6a5f75',
  primaryLight: '#8a7e94',
  primaryDark: '#4c4356',

  // CTA - Same as primary
  cta: '#6a5f75',

  // Secondary - Slightly darker brand grey-purple for emphasis
  secondary: '#4c4356',
  secondaryLight: '#6a5f75',
  secondaryDark: '#2f2937',

  // Accent - Mid-tone grey-purple (pills, subtle surfaces)
  accent: '#97919f',
  accentLight: '#c7c2cd',
  accentDark: '#6a5f75',

  // Highlight - Brand grey-purple family
  highlight: '#6a5f75',
  highlightLight: '#8a7e94',
  highlightDark: '#4c4356',

  // Background — solid canvas (never a gradient)
  background: '#e6e4e9',
  backgroundSecondary: '#d9d6dd',
  backgroundTertiary: '#c7c2cd',
  backgroundDark: '#97919f',

  // Surface - Elevated containers (white cards)
  surface: '#FFFFFF',
  surfaceLight: '#FBFAFD',
  surfaceElevated: '#FFFFFF',

  // Text - Deepest grey-purple for readability on the light canvas
  text: '#2f2937',
  textSecondary: '#4c4356',   // primary-dark as secondary text
  textMuted: '#8a7e94',
  textOnPrimary: '#FFFFFF',
  textOnSecondary: '#FFFFFF',
  white: '#FFFFFF',

  // Status colours — muted, earthy, harmonious with grey-purple
  success: '#5a7a68',         // dusty sage
  successLight: '#7a9a88',
  successDeep: '#4a6a58',     // verdict text on white glass (higher contrast)
  warning: '#a8724a',         // terracotta
  warningLight: '#c28a62',
  warningDeep: '#8a5a3a',
  error: '#9a4a4a',           // clay red
  errorLight: '#b46868',
  errorDeep: '#7a3a3a',
  info: '#5a7585',            // slate blue
  infoLight: '#7a95a5',

  // Border colors
  border: '#c7c2cd',
  borderLight: '#d9d6dd',
  borderAccent: '#6a5f75',

  // Overlay
  overlay: 'rgba(47, 41, 55, 0.8)',
  overlayLight: 'rgba(47, 41, 55, 0.5)',

  // Gradient endpoints — grey-purple scale
  gradientPrimary: ['#6a5f75', '#4c4356'],
  gradientAccent: ['#8a7e94', '#6a5f75'],
  gradientWarm: ['#97919f', '#6a5f75'],
  gradientCool: ['#b4afbb', '#6a5f75'],
};

// =============================================================================
// SPACING - 4px base unit
// =============================================================================
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
};

export const ms = (value: number) => value;

// =============================================================================
// BORDER RADIUS - Subtle, refined curves
// =============================================================================
export const borderRadius = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 20,
  xxxl: 28,
  pill: 9999,
  full: 9999,
};

// =============================================================================
// TYPOGRAPHY - Clean, readable, professional
// =============================================================================
export const typography = {
  // Display - Large hero text
  displayLarge: {
    ...headingSerif,
    fontSize: 48,
    fontWeight: '400' as const,
    lineHeight: 56,
    letterSpacing: -1,
  },
  displayMedium: {
    ...headingSerif,
    fontSize: 36,
    fontWeight: '400' as const,
    lineHeight: 44,
    letterSpacing: -0.5,
  },

  // Headings
  headingXL: {
    ...headingSerif,
    fontSize: 28,
    fontWeight: '400' as const,
    lineHeight: 36,
    letterSpacing: -0.5,
  },
  headingL: {
    ...headingSerif,
    fontSize: 24,
    fontWeight: '400' as const,
    lineHeight: 32,
    letterSpacing: -0.25,
  },
  headingM: {
    ...headingSerif,
    fontSize: 20,
    fontWeight: '400' as const,
    lineHeight: 28,
  },
  headingS: {
    fontFamily: fontFamily.primarySemiBold,
    fontSize: 16,
    fontWeight: '600' as const,
    lineHeight: 24,
  },

  // Body text — every size bumped +2pt (April 29 2026) to push back
  // against the lightness of a single-weight display serif. Without
  // a Bold variant we lean on size for visual presence; +2pt is the
  // smallest jump that meaningfully reads as "bigger" without
  // breaking the existing layout grid (chip rows, dock heights, etc.
  // were laid out around the prior 11–18pt scale and tolerate a
  // 2pt expansion). Line heights bumped proportionally.
  bodyLarge: {
    fontFamily: fontFamily.primary,
    fontSize: 20,
    fontWeight: '400' as const,
    lineHeight: 30,
  },
  body: {
    fontFamily: fontFamily.primary,
    fontSize: 17,
    fontWeight: '400' as const,
    lineHeight: 25,
  },
  bodySmall: {
    fontFamily: fontFamily.primary,
    fontSize: 15,
    fontWeight: '400' as const,
    lineHeight: 21,
  },

  // Labels & Buttons — Medium weight via DMSans-Medium (own family
  // file, see fontFamily comment).
  labelLarge: {
    fontFamily: fontFamily.primaryMedium,
    fontSize: 17,
    fontWeight: '500' as const,
    lineHeight: 25,
    letterSpacing: 0.1,
  },
  label: {
    fontFamily: fontFamily.primaryMedium,
    fontSize: 15,
    fontWeight: '500' as const,
    lineHeight: 21,
    letterSpacing: 0.1,
  },
  labelSmall: {
    fontFamily: fontFamily.primaryMedium,
    fontSize: 13,
    fontWeight: '500' as const,
    lineHeight: 18,
    letterSpacing: 0.2,
  },

  // Status banners — re-eval, "loading", "success", inline notices.
  // Smaller than body so the banner reads as ambient feedback rather
  // than primary content. Single source of truth so any future banner
  // (sync status, offline, undo prompt) inherits the size.
  banner: {
    fontFamily: fontFamily.primary,
    fontSize: 13,
    fontWeight: '400' as const,
    lineHeight: 18,
  },

  // Caption & Overline
  caption: {
    fontFamily: fontFamily.primary,
    fontSize: 14,
    fontWeight: '400' as const,
    lineHeight: 19,
  },
  overline: {
    fontFamily: fontFamily.primarySemiBold,
    fontSize: 13,
    fontWeight: '600' as const,
    lineHeight: 16,
    letterSpacing: 0.8,
    textTransform: 'uppercase' as const,
  },

  // @deprecated — use headingXL, headingM, headingS, labelLarge instead
  /** @deprecated use headingXL */ h1: { fontFamily: fontFamily.primarySemiBold, fontSize: 28, fontWeight: '600' as const, lineHeight: 36, letterSpacing: -0.5 },
  /** @deprecated use headingL */  h2: { fontFamily: fontFamily.primarySemiBold, fontSize: 22, fontWeight: '600' as const, lineHeight: 28 },
  /** @deprecated use bodyLarge */ h3: { fontFamily: fontFamily.primarySemiBold, fontSize: 18, fontWeight: '600' as const, lineHeight: 24 },
  /** @deprecated use labelLarge */ button: { fontFamily: fontFamily.primarySemiBold, fontSize: 16, fontWeight: '600' as const, lineHeight: 22 },
};

// =============================================================================
// SHADOWS - Subtle depth
// =============================================================================
export const shadows = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  xl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  // Glass shadow — gray-purple tint for glass cards on the light solid bg
  glass: {
    shadowColor: '#3f2b54',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 20,
    elevation: 6,
  },
  // Colored shadows — brand gray-purple
  glow: {
    shadowColor: '#5a4377',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  glowAccent: {
    shadowColor: '#7d6699',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
};

// =============================================================================
// GLASS STYLE — semi-transparent cards on solid gray-purple background
// Frost card: white tint with hairline border. On the solid #e4e2e9 canvas
// separation comes from shadow + slight brightness, no darker bottom to fight.
// =============================================================================
export const glass = {
  // Default glass treatment for cards on the solid light bg.
  backgroundColor: 'rgba(255, 255, 255, 0.75)',
  borderColor: 'rgba(255, 255, 255, 0.85)',
  borderWidth: 0.5,
  // Variant tuned for the FitResult dock — sits over a (potentially
  // busy) product image. Iterations (April 29 2026):
  //   0.65 → 0.58 → 0.55 — user wanted progressively more translucency
  //                         so the hero image breathes through. At
  //                         0.55 we're close to the floor where the
  //                         BlurView alone needs to carry legibility.
  // Works in tandem with the underlying BlurView; legibility is
  // still fine because the BlurView softens the imagery underneath.
  dockBackgroundColor: 'rgba(255, 255, 255, 0.55)',
  dockBorderColor: 'rgba(255, 255, 255, 0.9)',
};

// =============================================================================
// SEMANTIC TOKENS — derived alpha shades of the brand palette so we
// stop sprinkling rgba(106, 95, 117, 0.X) literals across the codebase.
// Each helper returns a pre-baked rgba string at the named alpha.
// =============================================================================

/** Build an rgba() string from a hex colour at a given alpha (0..1).
 *  Exported so consumers can derive ad-hoc tints from existing tokens
 *  (or component-local hex constants) without inlining `rgba(...)`
 *  literals — keeps the anti-pattern rule on hardcoded alphas honest. */
export const hexToRgba = (hex: string, alpha: number): string => {
  const cleaned = hex.replace('#', '');
  const r = parseInt(cleaned.substring(0, 2), 16);
  const g = parseInt(cleaned.substring(2, 4), 16);
  const b = parseInt(cleaned.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

/**
 * Pre-computed alpha variants of the primary brand colour. Use these
 * instead of inline rgba(106, 95, 117, 0.X) literals so the palette is
 * adjustable in ONE place.
 *
 *   tintXxs (4%)  — barely-there fill (hairline divider)
 *   tintXs (8%)   — subtle pill / chip background
 *   tintSm (12%)  — chip background, info banner
 *   tintMd (18%)  — opted-out / muted chip
 *   tintLg (32%)  — chevron pill on light bg
 *   tintXl (55%)  — chevron pill on image (back btn / delete btn)
 */
export const primaryAlpha = {
  tintXxs: hexToRgba(colors.primary, 0.04),
  tintXs: hexToRgba(colors.primary, 0.08),
  tintSm: hexToRgba(colors.primary, 0.12),
  tintMd: hexToRgba(colors.primary, 0.18),
  tintLg: hexToRgba(colors.primary, 0.32),
  tintXl: hexToRgba(colors.primary, 0.55),
};

/** Same idea for `colors.text` (deep grey-purple) — used for circular
 *  affordances on busy backgrounds (the "shield" colour scheme). */
export const textAlpha = {
  tintXs: hexToRgba(colors.text, 0.06),
  tintSm: hexToRgba(colors.text, 0.12),
  tintMd: hexToRgba(colors.text, 0.32),
  tintLg: hexToRgba(colors.text, 0.55),
  /** Hairline row dividers — text at 8%, used for borderBottomColor
   *  between rows inside list cards. */
  divider: hexToRgba(colors.text, 0.08),
};

/** Status colours pre-baked at common chip/badge alphas — keeps the
 *  green/red/orange tints consistent across availability, fit
 *  concerns, and verdict pills. */
export const statusAlpha = {
  successSoft: hexToRgba(colors.successDeep, 0.14),
  warningSoft: hexToRgba(colors.warningDeep, 0.14),
  errorSoft: hexToRgba(colors.errorDeep, 0.14),
  mutedSoft: hexToRgba(colors.textMuted, 0.10),
  /** Mid-tone variants — same chip role as *Soft but built on the
   *  brighter status hues (colors.success/warning/error rather than
   *  their *Deep counterparts), at a slightly heavier 18% alpha.
   *  Use these for verdict pills sitting on a frosted/dark backdrop
   *  where the soft (14% / deep-hue) variant disappears. */
  successMed: hexToRgba(colors.success, 0.18),
  warningMed: hexToRgba(colors.warning, 0.18),
  errorMed: hexToRgba(colors.error, 0.18),
};

/** White overlays for chrome and text on dark surfaces (gradient
 *  backdrops, full-bleed product imagery, and the floating tab pill).
 *  Tier names — surface/border/text — encode the role; the suffix
 *  encodes the visual weight. Replaces inline `rgba(255,255,255,0.X)`
 *  literals so all white tints flex from one place. */
export const whiteAlpha = {
  // Surfaces — chip / pill / card backgrounds over dark
  surfaceFaint: hexToRgba('#FFFFFF', 0.08),    // quiet pill on dark (Account reset)
  surfaceSoft: hexToRgba('#FFFFFF', 0.18),     // standard pill bg
  surfaceMid: hexToRgba('#FFFFFF', 0.20),      // editPill / sizePill bg
  surfaceStrong: hexToRgba('#FFFFFF', 0.22),   // emphasis chip
  surfaceFrost: hexToRgba('#FFFFFF', 0.58),    // floating-tab tint (AppNavigator)
  surfaceCard: hexToRgba('#FFFFFF', 0.78),     // frosted recent card on dark
  surfaceSolid: hexToRgba('#FFFFFF', 0.92),    // opaque static card (no BlurView)

  // Borders — paired with surfaces above
  borderFaint: hexToRgba('#FFFFFF', 0.30),     // FitLoader idle ring
  borderSoft: hexToRgba('#FFFFFF', 0.50),      // floating-tab edge
  borderMid: hexToRgba('#FFFFFF', 0.60),       // static-card edge
  borderStrong: hexToRgba('#FFFFFF', 0.85),    // frosted-card edge
  borderArc: hexToRgba('#FFFFFF', 0.95),       // FitLoader active arc

  // Text / icon tiers for white-on-dark legibility ladder
  textFaint: hexToRgba('#FFFFFF', 0.50),       // inactive divider glyph
  textSubtle: hexToRgba('#FFFFFF', 0.60),      // date stamp on photo
  textMuted: hexToRgba('#FFFFFF', 0.65),       // legal links
  textSecondary: hexToRgba('#FFFFFF', 0.70),   // secondary copy / icons on dark
  textBody: hexToRgba('#FFFFFF', 0.75),        // body on dark / recent label
  textBodyStrong: hexToRgba('#FFFFFF', 0.80),  // section labels
  textHigh: hexToRgba('#FFFFFF', 0.85),        // hero tagline
  textBright: hexToRgba('#FFFFFF', 0.88),      // magazine price
  textBrand: hexToRgba('#FFFFFF', 0.90),       // eyebrow wordmark
  textOpaque: hexToRgba('#FFFFFF', 0.92),      // hero body on photo

  // Icon-only — placeholder shopping-bag glyph at 20–25% (tiered)
  iconLow: hexToRgba('#FFFFFF', 0.20),
  iconLowest: hexToRgba('#FFFFFF', 0.18),
};

/** Pre-baked alphas of `colors.secondary` (#4c4356, the dark grey-purple)
 *  for bottom-edge fade gradients on Home + Account that resolve into
 *  the page backdrop's deepest stop. */
export const secondaryAlpha = {
  zero: hexToRgba(colors.secondary, 0),
  mid: hexToRgba(colors.secondary, 0.55),
  strong: hexToRgba(colors.secondary, 0.7),
  deep: hexToRgba(colors.secondary, 0.95),
  deeper: hexToRgba(colors.secondary, 0.97),
};

/** Dim scrim — deep navy-purple overlay used as a gradient stop on
 *  full-bleed product imagery (history cards). Anchors white text
 *  legibility without the heaviness of pure black; reads as an
 *  extension of the brand's deepest neutral, not a generic dim. */
const SCRIM_HEX = '#1c122a';
export const scrim = {
  zero: hexToRgba(SCRIM_HEX, 0),
  faint: hexToRgba(SCRIM_HEX, 0.05),
  soft: hexToRgba(SCRIM_HEX, 0.35),
  mid: hexToRgba(SCRIM_HEX, 0.55),
  strong: hexToRgba(SCRIM_HEX, 0.88),
  deep: hexToRgba(SCRIM_HEX, 0.96),
};

// =============================================================================
// DEFAULT EXPORT
// =============================================================================
export default {
  fontFamily,
  colors,
  spacing,
  ms,
  borderRadius,
  typography,
  shadows,
  glass,
  primaryAlpha,
  textAlpha,
  statusAlpha,
  whiteAlpha,
  secondaryAlpha,
  scrim,
};
