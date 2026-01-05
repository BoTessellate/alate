'use client';

import { forwardRef } from 'react';

export interface ToggleProps {
  /** Whether the toggle is on */
  checked: boolean;
  /** Change handler */
  onChange: (checked: boolean) => void;
  /** Disabled state */
  disabled?: boolean;
  /** Size */
  size?: 'sm' | 'md';
  /** Test ID */
  'data-testid'?: string;
}

/**
 * Toggle - Switch/toggle component
 *
 * Usage:
 * ```tsx
 * <Toggle
 *   checked={emailNotifications}
 *   onChange={setEmailNotifications}
 * />
 * ```
 */
export const Toggle = forwardRef<HTMLButtonElement, ToggleProps>(function Toggle(
  {
    checked,
    onChange,
    disabled = false,
    size = 'md',
    'data-testid': testId,
  },
  ref
) {
  const sizes = {
    sm: { track: 'w-9 h-5', thumb: 'w-3.5 h-3.5', translate: '16px' },
    md: { track: 'w-11 h-6', thumb: 'w-4 h-4', translate: '20px' },
  };

  const s = sizes[size];

  return (
    <button
      ref={ref}
      type="button"
      role="switch"
      aria-checked={checked}
      data-testid={testId}
      onClick={() => !disabled && onChange(!checked)}
      className={`relative ${s.track} rounded-full outline-none focus:outline-none focus-visible:outline-none ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      style={{
        backgroundColor: checked ? 'var(--primary-dark)' : 'var(--surface-light)',
        transition: 'all var(--transition-base) var(--ease-out)',
        boxShadow: checked ? '0 2px 8px rgba(0, 0, 0, 0.2)' : 'inset 0 1px 3px rgba(0, 0, 0, 0.1)',
      }}
    >
      <div
        className={`absolute top-1 ${s.thumb} rounded-full bg-white`}
        style={{
          left: checked ? s.translate : '4px',
          transition: 'all var(--transition-base) var(--ease-out)',
          transform: checked ? 'scale(1.1)' : 'scale(1)',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
        }}
      />
    </button>
  );
});
