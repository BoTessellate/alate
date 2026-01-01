'use client';

import Link from 'next/link';

export interface LogoProps {
  /** Whether we're on the looks list page (warm topbar) */
  isWarmTopbar: boolean;
  /** The effective theme (light or dark) */
  effectiveTheme: 'light' | 'dark';
}

/**
 * Logo - Brand logo with context-aware theming
 *
 * The logo needs to consider BOTH the page context (warm vs green topbar)
 * AND the theme (light vs dark) for proper contrast.
 *
 * Circle color logic:
 * - Looks list page (warm topbar): always charcoal (dark on cream)
 * - Other pages in light mode (green topbar): charcoal (dark on green)
 * - Other pages in dark mode (dark topbar): cream (light on dark)
 *
 * Pill color logic:
 * - Looks list page: primary green
 * - Light mode: primary green
 * - Dark mode: primary-dark (slightly darker green)
 */
export function Logo({ isWarmTopbar, effectiveTheme }: LogoProps) {
  // Circle: dark on warm/light topbar, light on dark topbar
  const circleColor = isWarmTopbar
    ? 'var(--charcoal)'
    : effectiveTheme === 'dark'
      ? 'var(--cream)'
      : 'var(--charcoal)';

  // Pill: primary green, darker variant on dark theme
  const pillColor = isWarmTopbar
    ? 'var(--primary)'
    : effectiveTheme === 'dark'
      ? 'var(--primary-dark)'
      : 'var(--primary)';

  return (
    <Link
      href="/"
      className="flex items-center transition-opacity hover:opacity-80"
    >
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center"
        style={{ backgroundColor: circleColor }}
      >
        <div
          className="w-4 h-1.5 rounded-full"
          style={{ backgroundColor: pillColor }}
        />
      </div>
    </Link>
  );
}
