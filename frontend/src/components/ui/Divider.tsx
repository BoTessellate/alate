'use client';

import type { ReactNode } from 'react';

export interface DividerProps {
  /** Orientation */
  orientation?: 'horizontal' | 'vertical';
  /** Optional label in the center */
  label?: ReactNode;
  /** Spacing around divider */
  spacing?: 'none' | 'sm' | 'md' | 'lg';
  /** Visual variant */
  variant?: 'default' | 'ornamental';
  /** Custom className */
  className?: string;
}

const spacingClasses = {
  none: '',
  sm: 'my-4',
  md: 'my-6',
  lg: 'my-8',
};

const verticalSpacingClasses = {
  none: '',
  sm: 'mx-4',
  md: 'mx-6',
  lg: 'mx-8',
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
  variant = 'default',
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

  // Ornamental divider with decorative flourishes
  if (variant === 'ornamental') {
    return (
      <div
        className={`flex items-center justify-center gap-4 ${spacingClasses[spacing]} ${className}`}
        role="separator"
      >
        <div
          className="flex-1 h-px"
          style={{
            background: 'linear-gradient(to right, transparent, var(--border))',
          }}
        />
        <span
          className="text-lg"
          style={{
            fontFamily: 'var(--font-cormorant)',
            color: 'var(--foreground-muted)',
            fontWeight: 300,
          }}
        >
          ✦
        </span>
        <div
          className="flex-1 h-px"
          style={{
            background: 'linear-gradient(to left, transparent, var(--border))',
          }}
        />
      </div>
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
