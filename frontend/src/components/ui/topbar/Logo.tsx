'use client';

import Link from 'next/link';
import type { TopbarVariant } from './useTopbarColors';

export interface LogoProps {
  /** The topbar variant for theming */
  topbarVariant: TopbarVariant;
  /** The effective theme (light or dark) */
  effectiveTheme: 'light' | 'dark';
}

/**
 * Logo - Brand logo with context-aware theming
 *
 * The logo needs to consider BOTH the page context (warm/green/highlight topbar)
 * AND the theme (light vs dark) for proper contrast.
 *
 * Circle color logic:
 * - Warm topbar (cream): charcoal (dark on cream)
 * - Highlight topbar (golden): charcoal (dark on gold for contrast)
 * - Default topbar (green) light mode: charcoal (dark on green)
 * - Default topbar (green) dark mode: cream (light on dark)
 *
 * Pill color logic:
 * - Warm topbar: primary green
 * - Highlight topbar: primary green
 * - Light mode: primary green
 * - Dark mode: primary-dark (slightly darker green)
 */
export function Logo({ topbarVariant, effectiveTheme }: LogoProps) {
  // Circle: dark on warm/highlight/light topbar, light on dark topbar
  const circleColor = topbarVariant === 'warm' || topbarVariant === 'highlight'
    ? 'var(--charcoal)'
    : effectiveTheme === 'dark'
      ? 'var(--cream)'
      : 'var(--charcoal)';

  // Pill: primary green, darker variant on dark theme
  const pillColor = topbarVariant === 'warm' || topbarVariant === 'highlight'
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
