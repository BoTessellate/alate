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
  // Monospace for code/data
  mono: 'ui-monospace, "SF Mono", Monaco, "Cascadia Code", monospace',
  // Fallback
  fallback: 'system-ui, sans-serif',
};

// =============================================================================
// COLOR PALETTE - Editorial Purple Theme (mature, beautiful, modern)
// Brand palette:
//   Deep:    #0f0325  #2c1853  #402d65  #625380
//   Mid:     #74698a  #968ab0  #a69fb5
//   Light:   #bbb1ce  #baaed2  #efedf5
// =============================================================================
export const colors = {
  // Primary - Deep brand purple (confident, editorial)
  primary: '#402d65',
  primaryLight: '#625380',
  primaryDark: '#2c1853',

  // CTA - Mid-lilac (the most abundantly used interactive colour)
  cta: '#7a6a92',

  // Secondary - Mid-purple for emphasis (price, callouts)
  secondary: '#2c1853',
  secondaryLight: '#625380',
  secondaryDark: '#0f0325',

  // Accent - Soft lavender (backgrounds of pills, subtle surfaces)
  accent: '#bbb1ce',
  accentLight: '#efedf5',
  accentDark: '#968ab0',

  // Highlight - Brand purple family (CTAs)
  highlight: '#402d65',
  highlightLight: '#625380',
  highlightDark: '#2c1853',

  // Background - Lilac (most-used brand color)
  background: '#efedf5',
  backgroundSecondary: '#E6DFF0',
  backgroundTertiary: '#D8D0E8',

  // Surface - Elevated containers (white cards)
  surface: '#FFFFFF',
  surfaceLight: '#FBFAFD',
  surfaceElevated: '#FFFFFF',

  // Text - Deep brand black for readability
  text: '#0f0325',
  textSecondary: '#4A3566',   // darkened from #625380 for WCAG AA contrast on light backgrounds
  textMuted: '#7A6D96',       // darkened from #968ab0 for WCAG AA contrast on light backgrounds
  textOnPrimary: '#FFFFFF',
  textOnSecondary: '#FFFFFF',
  white: '#FFFFFF',

  // Status colors (semantic — tuned to feel harmonious with purple)
  success: '#2E7D5B',
  successLight: '#4AA37F',
  warning: '#C2410C',
  warningLight: '#E06E1C',
  error: '#B91C1C',
  errorLight: '#DC2626',
  info: '#0E7490',            // teal-blue — distinct from primary purple, still harmonious
  infoLight: '#0891B2',

  // Border colors
  border: '#E6DFF0',
  borderLight: '#F2EEF8',
  borderAccent: '#402d65',

  // Overlay
  overlay: 'rgba(15, 3, 37, 0.8)',
  overlayLight: 'rgba(15, 3, 37, 0.5)',

  // Gradient endpoints
  gradientPrimary: ['#402d65', '#2c1853'],
  gradientAccent: ['#625380', '#402d65'],
  gradientWarm: ['#74698a', '#625380'],
  gradientCool: ['#968ab0', '#625380'],
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
  md: 6,
  lg: 8,
  xl: 12,
  xxl: 16,
  pill: 9999,
  full: 9999,
};

// =============================================================================
// TYPOGRAPHY - Clean, readable, professional
// =============================================================================
export const typography = {
  // Display - Large hero text
  displayLarge: {
    fontSize: 48,
    fontWeight: '700' as const,
    lineHeight: 56,
    letterSpacing: -1,
  },
  displayMedium: {
    fontSize: 36,
    fontWeight: '600' as const,
    lineHeight: 44,
    letterSpacing: -0.5,
  },

  // Headings
  headingXL: {
    fontSize: 28,
    fontWeight: '600' as const,
    lineHeight: 36,
    letterSpacing: -0.5,
  },
  headingL: {
    fontSize: 24,
    fontWeight: '600' as const,
    lineHeight: 32,
    letterSpacing: -0.25,
  },
  headingM: {
    fontSize: 20,
    fontWeight: '600' as const,
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
  // Colored shadows — brand purple
  glow: {
    shadowColor: '#402d65',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  glowAccent: {
    shadowColor: '#625380',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
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
};
