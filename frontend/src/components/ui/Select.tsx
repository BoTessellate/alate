'use client';

import {
  forwardRef,
  useState,
  type SelectHTMLAttributes,
  type ReactNode,
} from 'react';
import { ChevronDown } from 'lucide-react';

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  /** Label text */
  label?: string;
  /** Helper text below select */
  helperText?: string;
  /** Error message (shows error state) */
  error?: string;
  /** Size preset */
  size?: 'sm' | 'md' | 'lg';
  /** Full width */
  fullWidth?: boolean;
  /** Children (option elements) */
  children: ReactNode;
}

/**
 * Select - Styled dropdown select with validation states
 *
 * Usage:
 * ```tsx
 * <Select
 *   label="Country"
 *   error={errors.country}
 * >
 *   <option value="">Select a country</option>
 *   <option value="us">United States</option>
 *   <option value="uk">United Kingdom</option>
 * </Select>
 * ```
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  {
    label,
    helperText,
    error,
    size = 'md',
    fullWidth = true,
    className = '',
    id,
    children,
    ...props
  },
  ref
) {
  const [isFocused, setIsFocused] = useState(false);

  const selectId = id || `select-${label?.toLowerCase().replace(/\s+/g, '-')}`;

  const sizeClasses = {
    sm: 'h-8 text-xs',
    md: 'h-10 text-sm',
    lg: 'h-12 text-base',
  };

  const paddingClasses = {
    sm: 'pl-3 pr-8',
    md: 'pl-4 pr-10',
    lg: 'pl-5 pr-12',
  };

  const iconSizes = { sm: 14, md: 16, lg: 18 };
  const iconPositions = { sm: 'right-2.5', md: 'right-3', lg: 'right-4' };

  const getBorderColor = () => {
    if (error) return 'var(--error)';
    if (isFocused) return 'var(--primary-dark)';
    return 'var(--border)';
  };

  return (
    <div className={`${fullWidth ? 'w-full' : ''} ${className}`}>
      {label && (
        <label
          htmlFor={selectId}
          className="block text-sm font-medium mb-1.5"
          style={{ color: 'var(--foreground)' }}
        >
          {label}
        </label>
      )}
      <div className="relative">
        <select
          ref={ref}
          id={selectId}
          className={`w-full rounded-lg border outline-none transition-colors appearance-none cursor-pointer ${sizeClasses[size]} ${paddingClasses[size]}`}
          style={{
            backgroundColor: 'var(--background)',
            borderColor: getBorderColor(),
            color: 'var(--foreground)',
          }}
          onFocus={(e) => {
            setIsFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            props.onBlur?.(e);
          }}
          aria-invalid={!!error}
          aria-describedby={error ? `${selectId}-error` : helperText ? `${selectId}-helper` : undefined}
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          size={iconSizes[size]}
          className={`absolute ${iconPositions[size]} top-1/2 -translate-y-1/2 pointer-events-none`}
          style={{ color: 'var(--foreground-muted)' }}
        />
      </div>
      {error && (
        <p
          id={`${selectId}-error`}
          className="mt-1.5 text-xs"
          style={{ color: 'var(--error)' }}
        >
          {error}
        </p>
      )}
      {helperText && !error && (
        <p
          id={`${selectId}-helper`}
          className="mt-1.5 text-xs"
          style={{ color: 'var(--foreground-muted)' }}
        >
          {helperText}
        </p>
      )}
    </div>
  );
});
