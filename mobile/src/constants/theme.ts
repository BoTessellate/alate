/**
 * Design System - Theme Constants
 * Alate - Design System
 */

// =============================================================================
// FONT FAMILIES - Using system fonts for cross-platform consistency
// =============================================================================
export const fontFamily = {
  // Primary UI font - clean, professional sans-serif
  primary: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  // Accent/Display font - elegant serif for headings
  accent: 'Georgia, "Times New Roman", serif',
  // Display font loaded via expo-font (see App.tsx). Stand-in for TAN Nightingale
  // until we buy the real thing. Rendered lowercase on all heading tokens.
  display: 'DMSerifDisplay-Italic',
  // Monospace for code/data
  mono: 'ui-monospace, "SF Mono", Monaco, "Cascadia Code", monospace',
  // Fallback
  fallback: 'system-ui, sans-serif',
};

// Shared heading trait: every display/heading token mixes this in so the
// serif italic + lowercase transform stays consistent across the app.
const headingSerif = {
  fontFamily: 'DMSerifDisplay-Italic',
  textTransform: 'lowercase' as const,
};

// =============================================================================
// COLOR PALETTE - Gray-Purple system (matches website tonal scale)
// Background:     #e4e2e9  (solid, lightest stop of the website's tonal scale)
// Primary brand:  #5a4377  (used for buttons + bold text)
// =============================================================================
export const colors = {
  // Primary - Gray-purple brand colour (buttons, bold text)
  primary: '#5a4377',
  primaryLight: '#7d6699',
  primaryDark: '#3f2b54',

  // CTA - Same as primary (the main interactive colour everywhere)
  cta: '#5a4377',

  // Secondary - Slightly darker brand purple for emphasis (price, callouts)
  secondary: '#3f2b54',
  secondaryLight: '#5a4377',
  secondaryDark: '#2a1c3a',

  // Accent - Mid-tone gray-purple (pills, subtle surfaces)
  accent: '#9a92ac',
  accentLight: '#c5c0d2',
  accentDark: '#5a4377',

  // Highlight - Brand purple family
  highlight: '#5a4377',
  highlightLight: '#7d6699',
  highlightDark: '#3f2b54',

  // Background — solid, matches website canvas (lightest stop of tonal scale)
  background: '#e4e2e9',
  backgroundSecondary: '#d8d4de',
  backgroundTertiary: '#c5c0d2',
  backgroundDark: '#9a92ac',

  // Surface - Elevated containers (white cards)
  surface: '#FFFFFF',
  surfaceLight: '#FBFAFD',
  surfaceElevated: '#FFFFFF',

  // Text - Deep brand purple-black for readability on the light end of the gradient
  text: '#2a1c3a',
  textSecondary: '#5a4377',   // brand purple as secondary text
  textMuted: '#7d6699',       // lighter brand purple, still WCAG AA on #e4e2e9
  textOnPrimary: '#FFFFFF',
  textOnSecondary: '#FFFFFF',
  white: '#FFFFFF',

  // Status colors (semantic — tuned to feel harmonious with gray-purple)
  success: '#2E7D5B',
  successLight: '#4AA37F',
  warning: '#C2410C',
  warningLight: '#E06E1C',
  error: '#B91C1C',
  errorLight: '#DC2626',
  info: '#0E7490',            // teal-blue — distinct from primary purple, still harmonious
  infoLight: '#0891B2',

  // Border colors
  border: '#c5c0d2',
  borderLight: '#d8d4de',
  borderAccent: '#5a4377',

  // Overlay
  overlay: 'rgba(42, 28, 58, 0.8)',
  overlayLight: 'rgba(42, 28, 58, 0.5)',

  // Gradient endpoints
  gradientPrimary: ['#5a4377', '#3f2b54'],
  gradientAccent: ['#7d6699', '#5a4377'],
  gradientWarm: ['#9a92ac', '#5a4377'],
  gradientCool: ['#b5afc4', '#5a4377'],
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
    fontSize: 16,
    fontWeight: '600' as const,
    lineHeight: 24,
  },

  // Body text
  bodyLarge: {
    fontSize: 18,
    fontWeight: '400' as const,
    lineHeight: 28,
  },
  body: {
    fontSize: 15,
    fontWeight: '400' as const,
    lineHeight: 22,
  },
  bodySmall: {
    fontSize: 13,
    fontWeight: '400' as const,
    lineHeight: 18,
  },

  // Labels & Buttons
  labelLarge: {
    fontSize: 15,
    fontWeight: '500' as const,
    lineHeight: 22,
    letterSpacing: 0.1,
  },
  label: {
    fontSize: 13,
    fontWeight: '500' as const,
    lineHeight: 18,
    letterSpacing: 0.1,
  },
  labelSmall: {
    fontSize: 11,
    fontWeight: '500' as const,
    lineHeight: 16,
    letterSpacing: 0.2,
  },

  // Caption & Overline
  caption: {
    fontSize: 12,
    fontWeight: '400' as const,
    lineHeight: 16,
  },
  overline: {
    fontSize: 11,
    fontWeight: '600' as const,
    lineHeight: 14,
    letterSpacing: 0.8,
    textTransform: 'uppercase' as const,
  },

  // @deprecated — use headingXL, headingM, headingS, labelLarge instead
  /** @deprecated use headingXL */ h1: { fontSize: 28, fontWeight: '600' as const, lineHeight: 36, letterSpacing: -0.5 },
  /** @deprecated use headingL */  h2: { fontSize: 22, fontWeight: '600' as const, lineHeight: 28 },
  /** @deprecated use bodyLarge */ h3: { fontSize: 18, fontWeight: '600' as const, lineHeight: 24 },
  /** @deprecated use labelLarge */ button: { fontSize: 16, fontWeight: '600' as const, lineHeight: 22 },
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
