'use client';

import { type ReactNode } from 'react';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
}

export interface SegmentedControlProps<T extends string> {
  /** Label text */
  label?: string;
  /** Currently selected value */
  value: T;
  /** Available options */
  options: SegmentOption<T>[];
  /** Change handler */
  onChange: (value: T) => void;
  /** Helper text below control */
  helperText?: string;
  /** Size preset */
  size?: 'sm' | 'md' | 'lg';
  /** Full width */
  fullWidth?: boolean;
  /** Custom className */
  className?: string;
  /** Disabled state */
  disabled?: boolean;
}

/**
 * SegmentedControl - Toggle button group for selecting between options
 *
 * Usage:
 * ```tsx
 * <SegmentedControl
 *   label="Detection Mode"
 *   value={mode}
 *   onChange={setMode}
 *   options={[
 *     { value: 'single', label: 'Single', icon: <ImageIcon size={16} /> },
 *     { value: 'multiple', label: 'Multiple', icon: <Layers size={16} /> },
 *   ]}
 * />
 * ```
 */
export function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
  helperText,
  size = 'md',
  fullWidth = true,
  className = '',
  disabled = false,
}: SegmentedControlProps<T>) {
  const sizeClasses = {
    sm: 'p-1.5 text-xs',
    md: 'p-2 text-sm',
    lg: 'p-3 text-base',
  };

  const iconSizes = { sm: 14, md: 16, lg: 18 };

  return (
    <div className={`${fullWidth ? 'w-full' : ''} ${className}`}>
      {label && (
        <label
          className="block text-sm font-medium mb-2"
          style={{ color: 'var(--foreground)' }}
        >
          {label}
        </label>
      )}
      <div className="flex gap-2">
        {options.map((option) => {
          const isSelected = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => !disabled && onChange(option.value)}
              disabled={disabled}
              className={`flex-1 flex items-center justify-center gap-2 rounded-lg border transition-colors ${sizeClasses[size]}`}
              style={{
                borderColor: isSelected ? 'var(--primary-dark)' : 'var(--border)',
                backgroundColor: isSelected ? 'var(--primary-alpha)' : 'transparent',
                color: 'var(--foreground)',
                opacity: disabled ? 0.5 : 1,
                cursor: disabled ? 'not-allowed' : 'pointer',
              }}
            >
              {option.icon}
              <span>{option.label}</span>
            </button>
          );
        })}
      </div>
      {helperText && (
        <p
          className="text-xs mt-1"
          style={{ color: 'var(--foreground-muted)' }}
        >
          {helperText}
        </p>
      )}
    </div>
  );
}
