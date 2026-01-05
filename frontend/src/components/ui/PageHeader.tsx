'use client';

import type { ReactNode } from 'react';

export interface PageHeaderProps {
  /** Page title */
  title: string;
  /** Optional subtitle/description */
  subtitle?: string;
  /** Optional badge/count next to title */
  badge?: ReactNode;
  /** Actions on the right side (or below title in centered layout) */
  actions?: ReactNode;
  /** Layout variant */
  variant?: 'default' | 'centered';
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Max width container */
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '5xl' | '7xl' | 'none';
  /** Custom className */
  className?: string;
}

const sizeStyles = {
  sm: { title: 'text-2xl', padding: 'px-6 pt-6 pb-4' },
  md: { title: 'text-3xl', padding: 'px-8 pt-8 pb-6' },
  lg: { title: 'text-4xl', padding: 'px-8 pt-8 pb-6' },
};

const maxWidthStyles = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '5xl': 'max-w-5xl',
  '7xl': 'max-w-7xl',
  none: '',
};

/**
 * PageHeader - Consistent page header with title and actions
 *
 * Usage:
 * ```tsx
 * // Default layout (left-aligned with actions on right)
 * <PageHeader
 *   title="Layers"
 *   subtitle="Your moodboards"
 *   badge={<span>12</span>}
 *   actions={<Button icon={Plus}>New Layer</Button>}
 * />
 *
 * // Centered layout (for wizards/onboarding)
 * <PageHeader
 *   variant="centered"
 *   title="Tell me about your style"
 *   subtitle="Select at least 2 styles that vibe with you."
 * />
 * ```
 */
export function PageHeader({
  title,
  subtitle,
  badge,
  actions,
  variant = 'default',
  size = 'lg',
  maxWidth = '7xl',
  className = '',
}: PageHeaderProps) {
  const styles = sizeStyles[size];
  const maxWidthClass = maxWidthStyles[maxWidth];

  if (variant === 'centered') {
    return (
      <div className={`text-center ${styles.padding} ${maxWidthClass} mx-auto ${className}`}>
        <h1
          className={`${styles.title} italic mb-2`}
          style={{
            fontFamily: 'var(--font-cormorant)',
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: 'var(--foreground)',
          }}
        >
          {title}
        </h1>
        {subtitle && (
          <p
            className="text-sm mb-6"
            style={{ color: 'var(--foreground-secondary)' }}
          >
            {subtitle}
          </p>
        )}
        {actions && <div className="flex items-center justify-center gap-3">{actions}</div>}
      </div>
    );
  }

  return (
    <div className={`${styles.padding} ${maxWidthClass} mx-auto ${className}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-baseline gap-3 flex-1">
          <h1
            className={`${styles.title} italic`}
            style={{
              fontFamily: 'var(--font-cormorant)',
              fontWeight: 700,
              letterSpacing: '-0.02em',
              color: 'var(--foreground)',
            }}
          >
            {title}
          </h1>
          {subtitle && (
            <span
              className="text-sm"
              style={{ color: 'var(--foreground-muted)' }}
            >
              {subtitle}
            </span>
          )}
          {badge && (
            <span
              className="text-sm font-medium px-2 py-0.5 rounded-full"
              style={{
                backgroundColor: 'var(--surface-light)',
                color: 'var(--foreground-muted)',
              }}
            >
              {badge}
            </span>
          )}
        </div>
        {actions && <div className="flex items-center gap-3">{actions}</div>}
      </div>
    </div>
  );
}

export interface SectionHeaderProps {
  /** Section title */
  title: string;
  /** Optional subtitle */
  subtitle?: string;
  /** Actions on the right side */
  actions?: ReactNode;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Use italic editorial style (Cormorant font) */
  italic?: boolean;
  /** Custom className */
  className?: string;
}

const sectionSizeStyles = {
  sm: { title: 'text-lg', gap: 'gap-2' },
  md: { title: 'text-xl', gap: 'gap-3' },
  lg: { title: 'text-2xl', gap: 'gap-4' },
};

/**
 * SectionHeader - Smaller header for page sections
 *
 * Usage:
 * ```tsx
 * // Default size
 * <SectionHeader title="Add Products" actions={<Button size="sm">Refresh</Button>} />
 *
 * // Small size for sidebars
 * <SectionHeader size="sm" title="Add Products" />
 * ```
 */
export function SectionHeader({
  title,
  subtitle,
  actions,
  size = 'lg',
  italic = false,
  className = '',
}: SectionHeaderProps) {
  const styles = sectionSizeStyles[size];

  return (
    <div className={`flex items-center justify-between ${styles.gap} mb-4 ${className}`}>
      <div className="flex items-baseline gap-3">
        <h2
          className={`${styles.title} ${italic ? 'italic' : 'font-semibold'}`}
          style={{
            color: 'var(--foreground)',
            ...(italic && {
              fontFamily: 'var(--font-cormorant)',
              fontWeight: 500,
            }),
          }}
        >
          {title}
        </h2>
        {subtitle && (
          <span
            className="text-sm"
            style={{ color: 'var(--foreground-muted)' }}
          >
            {subtitle}
          </span>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
