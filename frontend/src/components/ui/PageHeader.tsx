'use client';

import type { ReactNode } from 'react';

export interface PageHeaderProps {
  /** Page title */
  title: string;
  /** Optional subtitle/description */
  subtitle?: string;
  /** Optional badge/count next to title */
  badge?: ReactNode;
  /** Actions on the right side */
  actions?: ReactNode;
  /** Custom className */
  className?: string;
}

/**
 * PageHeader - Consistent page header with title and actions
 *
 * Usage:
 * ```tsx
 * <PageHeader
 *   title="Layers"
 *   subtitle="Your moodboards"
 *   badge={<span>12</span>}
 *   actions={<Button icon={Plus}>New Layer</Button>}
 * />
 * ```
 */
export function PageHeader({
  title,
  subtitle,
  badge,
  actions,
  className = '',
}: PageHeaderProps) {
  return (
    <div className={`px-8 pt-8 pb-6 max-w-7xl mx-auto ${className}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-baseline gap-3">
          <h1
            className="text-4xl italic"
            style={{
              fontFamily: 'var(--font-cormorant)',
              fontWeight: 500,
              color: 'var(--foreground)',
            }}
          >
            {title}
          </h1>
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
          {subtitle && (
            <span
              className="text-sm"
              style={{ color: 'var(--foreground-muted)' }}
            >
              {subtitle}
            </span>
          )}
        </div>
        {actions && <div className="flex items-center gap-3">{actions}</div>}
      </div>
    </div>
  );
}

/**
 * SectionHeader - Smaller header for page sections
 */
export function SectionHeader({
  title,
  subtitle,
  actions,
  className = '',
}: Omit<PageHeaderProps, 'badge'>) {
  return (
    <div className={`flex items-center justify-between gap-4 mb-4 ${className}`}>
      <div>
        <h2
          className="text-2xl italic"
          style={{
            fontFamily: 'var(--font-cormorant)',
            fontWeight: 500,
            color: 'var(--foreground)',
          }}
        >
          {title}
        </h2>
        {subtitle && (
          <p
            className="text-sm mt-0.5"
            style={{ color: 'var(--foreground-muted)' }}
          >
            {subtitle}
          </p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
