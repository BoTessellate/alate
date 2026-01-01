'use client';

import type { ReactNode } from 'react';

export interface DividerProps {
  /** Orientation */
  orientation?: 'horizontal' | 'vertical';
  /** Optional label in the center */
  label?: ReactNode;
  /** Spacing around divider */
  spacing?: 'none' | 'sm' | 'md' | 'lg';
  /** Custom className */
  className?: string;
}

const spacingClasses = {
  none: '',
  sm: 'my-2',
  md: 'my-4',
  lg: 'my-6',
};

const verticalSpacingClasses = {
  none: '',
  sm: 'mx-2',
  md: 'mx-4',
  lg: 'mx-6',
};

/**
 * Divider - Visual separator
 *
 * Usage:
 * ```tsx
 * <Divider />
 * <Divider label="or" />
 * <Divider orientation="vertical" />
 * ```
 */
export function Divider({
  orientation = 'horizontal',
  label,
  spacing = 'md',
  className = '',
}: DividerProps) {
  if (orientation === 'vertical') {
    return (
      <div
        className={`w-px self-stretch ${verticalSpacingClasses[spacing]} ${className}`}
        style={{ backgroundColor: 'var(--border)' }}
        role="separator"
        aria-orientation="vertical"
      />
    );
  }

  if (label) {
    return (
      <div
        className={`flex items-center gap-4 ${spacingClasses[spacing]} ${className}`}
        role="separator"
      >
        <div
          className="flex-1 h-px"
          style={{ backgroundColor: 'var(--border)' }}
        />
        <span
          className="text-xs font-medium"
          style={{ color: 'var(--foreground-muted)' }}
        >
          {label}
        </span>
        <div
          className="flex-1 h-px"
          style={{ backgroundColor: 'var(--border)' }}
        />
      </div>
    );
  }

  return (
    <div
      className={`h-px w-full ${spacingClasses[spacing]} ${className}`}
      style={{ backgroundColor: 'var(--border)' }}
      role="separator"
      aria-orientation="horizontal"
    />
  );
}
