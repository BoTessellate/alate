/**
 * Centralized theme tokens
 * All color values should be defined here and imported elsewhere
 */

export const THEME_TOKENS = {
  light: {
    background: '#E8EAE3',
    backgroundSecondary: '#DFE2DA',
    backgroundTertiary: '#F0F2EB',
    surface: '#FFFFFF',
    surfaceLight: '#F5F6F2',
    surfaceElevated: '#FFFFFF',
    foreground: '#222222',
    foregroundSecondary: '#444444',
    foregroundMuted: '#666666',
    border: '#D0D3C9',
    borderLight: '#C5C8BE',
    topbarBg: 'rgba(76, 112, 49, 0.92)',
  },
  dark: {
    background: '#0d0d0d',
    backgroundSecondary: '#151515',
    backgroundTertiary: '#0a0a0a',
    surface: '#1a1a1a',
    surfaceLight: '#252525',
    surfaceElevated: '#303030',
    foreground: '#f6e9cf',
    foregroundSecondary: '#d4c9b0',
    foregroundMuted: '#b0a090',
    border: '#2a2a2a',
    borderLight: '#3a3a3a',
    topbarBg: 'rgba(13, 13, 13, 0.95)',
  },
  // Brand colors (theme-independent)
  brand: {
    primary: '#4c7031',
    primaryLight: '#546c22',
    primaryDark: '#3D522D',
    secondary: '#8b6b4a',
    accent: '#4c7031',
    highlight: '#c4a35a',
    cream: '#F4EFED',
    charcoal: '#222222',
    success: '#4c7031',
    warning: '#c4a35a',
    error: '#a84032',
    info: '#4a7c9b',
  },
  // Logo colors by theme
  logo: {
    light: { circle: '#222222', pill: '#546c22' },
    dark: { circle: '#F4EFED', pill: '#546c22' },
  },
} as const;

export type ThemeMode = 'light' | 'dark';

/**
 * Apply theme tokens to CSS variables
 */
export function applyThemeTokens(theme: ThemeMode): void {
  const root = document.documentElement;
  const tokens = THEME_TOKENS[theme];

  root.style.setProperty('--background', tokens.background);
  root.style.setProperty('--background-secondary', tokens.backgroundSecondary);
  root.style.setProperty('--background-tertiary', tokens.backgroundTertiary);
  root.style.setProperty('--surface', tokens.surface);
  root.style.setProperty('--surface-light', tokens.surfaceLight);
  root.style.setProperty('--surface-elevated', tokens.surfaceElevated);
  root.style.setProperty('--foreground', tokens.foreground);
  root.style.setProperty('--foreground-secondary', tokens.foregroundSecondary);
  root.style.setProperty('--foreground-muted', tokens.foregroundMuted);
  root.style.setProperty('--border', tokens.border);
  root.style.setProperty('--border-light', tokens.borderLight);
  root.style.setProperty('--topbar-bg', tokens.topbarBg);
  root.setAttribute('data-theme', theme);
}

/**
 * Generate inline script for initial theme (prevents flash)
 * This needs to be a string for dangerouslySetInnerHTML in layout
 */
export function getThemeInitScript(): string {
  // Inline the tokens to avoid module loading issues
  const light = THEME_TOKENS.light;
  const dark = THEME_TOKENS.dark;

  return `(function() {
  try {
    var stored = localStorage.getItem('mood-layer-settings');
    var theme = stored ? JSON.parse(stored).state.theme : 'system';
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var effectiveTheme = theme === 'system' ? (prefersDark ? 'dark' : 'light') : theme;
    var root = document.documentElement;
    var tokens = effectiveTheme === 'light'
      ? ${JSON.stringify(light)}
      : ${JSON.stringify(dark)};

    root.style.setProperty('--background', tokens.background);
    root.style.setProperty('--background-secondary', tokens.backgroundSecondary);
    root.style.setProperty('--background-tertiary', tokens.backgroundTertiary);
    root.style.setProperty('--surface', tokens.surface);
    root.style.setProperty('--surface-light', tokens.surfaceLight);
    root.style.setProperty('--surface-elevated', tokens.surfaceElevated);
    root.style.setProperty('--foreground', tokens.foreground);
    root.style.setProperty('--foreground-secondary', tokens.foregroundSecondary);
    root.style.setProperty('--foreground-muted', tokens.foregroundMuted);
    root.style.setProperty('--border', tokens.border);
    root.style.setProperty('--border-light', tokens.borderLight);
    root.style.setProperty('--topbar-bg', tokens.topbarBg);
    root.setAttribute('data-theme', effectiveTheme);
  } catch (e) {}
})();`;
}
