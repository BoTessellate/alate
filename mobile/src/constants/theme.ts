/**
 * Design System - Theme Constants
 * Alate - Design System
 */

// =============================================================================
// FONT FAMILIES
// =============================================================================
// The display face is TAN Nightingale (rendered as SVGs by HeadingImage).
// Body copy now runs on a system serif so it pairs with Nightingale's
// art-deco serif character — mixing sans body with a display serif made
// the headings feel like stickers dropped onto sans-serif chrome.
// Platform-specific serifs: 'Times New Roman' (iOS Western default),
// 'serif' (Android → Noto Serif, which ships on every Android device).
export const fontFamily = {
  // Primary UI font — system serif that pairs with TAN Nightingale.
  primary: 'serif',
  // Legacy alias for the editorial body face
  accent: 'Georgia',
  // Display font loaded via expo-font (see App.tsx). Stand-in for TAN Nightingale
  // when the SVG slot falls back to text (i.e. missing asset).
  display: 'DMSerifDisplay-Italic',
  // Monospace for code/data
  mono: 'ui-monospace, "SF Mono", Monaco, "Cascadia Code", monospace',
  // Fallback
  fallback: 'serif',
};

// Shared heading trait: every display/heading token mixes this in so the
// serif italic + lowercase transform stays consistent across the app.
const headingSerif = {
  fontFamily: 'DMSerifDisplay-Italic',
  textTransform: 'lowercase' as const,
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
    fontFamily: 'serif',
    fontSize: 16,
    fontWeight: '600' as const,
    lineHeight: 24,
  },

  // Body text — now on system serif to pair with TAN Nightingale
  bodyLarge: {
    fontFamily: 'serif',
    fontSize: 18,
    fontWeight: '400' as const,
    lineHeight: 28,
  },
  body: {
    fontFamily: 'serif',
    fontSize: 15,
    fontWeight: '400' as const,
    lineHeight: 22,
  },
  bodySmall: {
    fontFamily: 'serif',
    fontSize: 13,
    fontWeight: '400' as const,
    lineHeight: 18,
  },

  // Labels & Buttons — serif so small copy matches the editorial voice
  labelLarge: {
    fontFamily: 'serif',
    fontSize: 15,
    fontWeight: '500' as const,
    lineHeight: 22,
    letterSpacing: 0.1,
  },
  label: {
    fontFamily: 'serif',
    fontSize: 13,
    fontWeight: '500' as const,
    lineHeight: 18,
    letterSpacing: 0.1,
  },
  labelSmall: {
    fontFamily: 'serif',
    fontSize: 11,
    fontWeight: '500' as const,
    lineHeight: 16,
    letterSpacing: 0.2,
  },

  // Caption & Overline
  caption: {
    fontFamily: 'serif',
    fontSize: 12,
    fontWeight: '400' as const,
    lineHeight: 16,
  },
  overline: {
    fontFamily: 'serif',
    fontSize: 11,
    fontWeight: '600' as const,
    lineHeight: 14,
    letterSpacing: 0.8,
    textTransform: 'uppercase' as const,
  },

  // @deprecated — use headingXL, headingM, headingS, labelLarge instead
  /** @deprecated use headingXL */ h1: { fontFamily: 'serif', fontSize: 28, fontWeight: '600' as const, lineHeight: 36, letterSpacing: -0.5 },
  /** @deprecated use headingL */  h2: { fontFamily: 'serif', fontSize: 22, fontWeight: '600' as const, lineHeight: 28 },
  /** @deprecated use bodyLarge */ h3: { fontFamily: 'serif', fontSize: 18, fontWeight: '600' as const, lineHeight: 24 },
  /** @deprecated use labelLarge */ button: { fontFamily: 'serif', fontSize: 16, fontWeight: '600' as const, lineHeight: 22 },
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
  backgroundColor: 'rgba(255, 255, 255, 0.75)',
  borderColor: 'rgba(255, 255, 255, 0.85)',
  borderWidth: 0.5,
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
};
