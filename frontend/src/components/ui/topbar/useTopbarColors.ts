/**
 * useTopbarColors - Computes topbar-aware colors based on page context
 *
 * This hook provides consistent theming for all topbar components.
 * Instead of passing multiple props (isLooksListPage, effectiveTheme),
 * components call this hook once and get all computed colors.
 */

export type TopbarVariant = 'default' | 'warm' | 'highlight';

export interface TopbarColors {
  // Text colors
  text: string;
  textMuted: string;

  // Background colors for interactive elements
  defaultBg: string;
  hoverBg: string;
  activeBg: string;

  // Border color
  border: string;
}

/**
 * Get topbar colors based on the topbar variant
 * - default: green topbar (most pages)
 * - warm: cream topbar (/looks page)
 * - highlight: golden topbar (/discover page)
 */
export function getTopbarColors(variant: TopbarVariant): TopbarColors {
  if (variant === 'warm') {
    // Warm topbar (looks list page) - dark text on cream background
    return {
      text: 'var(--charcoal)',
      textMuted: 'rgba(34, 34, 34, 0.75)',
      defaultBg: 'rgba(0, 0, 0, 0.08)',
      hoverBg: 'rgba(0, 0, 0, 0.15)',
      activeBg: 'rgba(0, 0, 0, 0.1)',
      border: 'rgba(0, 0, 0, 0.15)',
    };
  } else if (variant === 'highlight') {
    // Highlight topbar (discover page) - light text on golden background
    return {
      text: 'white',
      textMuted: 'rgba(255, 255, 255, 0.8)',
      defaultBg: 'rgba(255, 255, 255, 0.15)',
      hoverBg: 'rgba(255, 255, 255, 0.25)',
      activeBg: 'rgba(255, 255, 255, 0.2)',
      border: 'rgba(255, 255, 255, 0.2)',
    };
  } else {
    // Default topbar (green) - light text on dark background
    return {
      text: 'white',
      textMuted: 'rgba(255, 255, 255, 0.75)',
      defaultBg: 'rgba(255, 255, 255, 0.15)',
      hoverBg: 'rgba(255, 255, 255, 0.25)',
      activeBg: 'rgba(255, 255, 255, 0.2)',
      border: 'rgba(255, 255, 255, 0.2)',
    };
  }
}
