/**
 * Design System - Theme Constants
 * TML Moodboard - Refined & Professional Design System
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
// COLOR PALETTE - Sophisticated & Modern
// =============================================================================
export const colors = {
  // Primary - Deep indigo (professional, creative)
  primary: '#6366F1',
  primaryLight: '#818CF8',
  primaryDark: '#4F46E5',

  // Secondary - Warm rose (sophisticated accent)
  secondary: '#EC4899',
  secondaryLight: '#F472B6',
  secondaryDark: '#DB2777',

  // Accent - Teal (fresh, modern)
  accent: '#14B8A6',
  accentLight: '#2DD4BF',
  accentDark: '#0D9488',

  // Highlight - Amber (warm touch)
  highlight: '#F59E0B',
  highlightLight: '#FBBF24',
  highlightDark: '#D97706',

  // Background - Deep slate with blue undertone
  background: '#0F172A',
  backgroundSecondary: '#1E293B',
  backgroundTertiary: '#020617',

  // Surface - Elevated containers
  surface: '#1E293B',
  surfaceLight: '#334155',
  surfaceElevated: '#475569',

  // Text colors - Clean hierarchy
  text: '#F8FAFC',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',
  textOnPrimary: '#FFFFFF',
  textOnSecondary: '#FFFFFF',

  // Status colors
  success: '#22C55E',
  successLight: '#4ADE80',
  warning: '#F59E0B',
  warningLight: '#FBBF24',
  error: '#EF4444',
  errorLight: '#F87171',
  info: '#3B82F6',
  infoLight: '#60A5FA',

  // Border colors
  border: '#334155',
  borderLight: '#475569',
  borderAccent: '#6366F1',

  // Overlay
  overlay: 'rgba(2, 6, 23, 0.8)',
  overlayLight: 'rgba(2, 6, 23, 0.5)',

  // Gradient endpoints
  gradientPrimary: ['#6366F1', '#4F46E5'],
  gradientAccent: ['#EC4899', '#DB2777'],
  gradientWarm: ['#F59E0B', '#EA580C'],
  gradientCool: ['#14B8A6', '#3B82F6'],
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

  // Legacy aliases
  h1: {
    fontSize: 28,
    fontWeight: '600' as const,
    lineHeight: 36,
    letterSpacing: -0.5,
  },
  h2: {
    fontSize: 22,
    fontWeight: '600' as const,
    lineHeight: 28,
  },
  h3: {
    fontSize: 18,
    fontWeight: '600' as const,
    lineHeight: 24,
  },
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
  // Colored shadows
  glow: {
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  glowAccent: {
    shadowColor: '#EC4899',
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
  borderRadius,
  typography,
  shadows,
};
