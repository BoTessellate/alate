'use client';

import { forwardRef, useState, type InputHTMLAttributes } from 'react';
import { Check } from 'lucide-react';

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  /** Label text */
  label?: string;
  /** Size preset */
  size?: 'sm' | 'md' | 'lg';
  /** Helper text below checkbox */
  helperText?: string;
  /** Error state */
  error?: boolean;
}

const sizeConfig = {
  sm: { box: 'w-4 h-4', icon: 12, text: 'text-xs', gap: 'gap-2' },
  md: { box: 'w-5 h-5', icon: 14, text: 'text-sm', gap: 'gap-2.5' },
  lg: { box: 'w-6 h-6', icon: 16, text: 'text-base', gap: 'gap-3' },
};

/**
 * Checkbox - Styled checkbox with label support
 *
 * Usage:
 * ```tsx
 * <Checkbox
 *   label="Accept terms"
 *   checked={accepted}
 *   onChange={(e) => setAccepted(e.target.checked)}
 * />
 * ```
 */
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  {
    label,
    size = 'md',
    helperText,
    error = false,
    className = '',
    disabled,
    checked,
    ...props
  },
  ref
) {
  const [isFocused, setIsFocused] = useState(false);
  const config = sizeConfig[size];

  const getBorderColor = () => {
    if (error) return 'var(--error)';
    if (checked) return 'var(--primary-dark)';
    if (isFocused) return 'var(--primary-dark)';
    return 'var(--border)';
  };

  return (
    <label
      className={`inline-flex items-start ${config.gap} ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${className}`}
    >
      <div className="relative flex-shrink-0">
        <input
          ref={ref}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          className="sr-only peer"
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          {...props}
        />
        <div
          className={`${config.box} rounded border-2 flex items-center justify-center transition-colors`}
          style={{
            borderColor: getBorderColor(),
            backgroundColor: checked ? 'var(--primary-dark)' : 'transparent',
          }}
        >
          {checked && (
            <Check
              size={config.icon}
              strokeWidth={3}
              style={{ color: 'white' }}
            />
          )}
        </div>
      </div>
      {(label || helperText) && (
        <div className="flex flex-col">
          {label && (
            <span
              className={`${config.text} font-medium`}
              style={{ color: 'var(--foreground)' }}
            >
              {label}
            </span>
          )}
          {helperText && (
            <span
              className="text-xs mt-0.5"
              style={{ color: error ? 'var(--error)' : 'var(--foreground-muted)' }}
            >
              {helperText}
            </span>
          )}
        </div>
      )}
    </label>
  );
});
