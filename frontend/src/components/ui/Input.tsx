'use client';

import {
  forwardRef,
  useState,
  type InputHTMLAttributes,
  type TextareaHTMLAttributes,
  type ReactNode,
} from 'react';
import { type LucideIcon, Eye, EyeOff } from 'lucide-react';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  /** Label text */
  label?: string;
  /** Helper text below input */
  helperText?: string;
  /** Error message (shows error state) */
  error?: string;
  /** Size preset */
  size?: 'sm' | 'md' | 'lg';
  /** Icon on the left */
  icon?: LucideIcon;
  /** Icon on the right */
  iconRight?: LucideIcon;
  /** Full width */
  fullWidth?: boolean;
}

/**
 * Input - Styled text input with validation states
 *
 * Usage:
 * ```tsx
 * <Input
 *   label="Email"
 *   placeholder="you@example.com"
 *   icon={Mail}
 *   error={errors.email}
 * />
 * ```
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    label,
    helperText,
    error,
    size = 'md',
    icon: Icon,
    iconRight: IconRight,
    fullWidth = true,
    className = '',
    id,
    ...props
  },
  ref
) {
  const [isFocused, setIsFocused] = useState(false);

  const inputId = id || `input-${label?.toLowerCase().replace(/\s+/g, '-')}`;

  const sizeClasses = {
    sm: 'h-8 text-xs',
    md: 'h-10 text-sm',
    lg: 'h-12 text-base',
  };

  const paddingClasses = {
    sm: Icon ? 'pl-8 pr-3' : IconRight ? 'pl-3 pr-8' : 'px-3',
    md: Icon ? 'pl-10 pr-4' : IconRight ? 'pl-4 pr-10' : 'px-4',
    lg: Icon ? 'pl-12 pr-5' : IconRight ? 'pl-5 pr-12' : 'px-5',
  };

  const iconSizes = { sm: 14, md: 16, lg: 18 };
  const iconPositions = { sm: 'left-2.5', md: 'left-3', lg: 'left-4' };
  const iconRightPositions = { sm: 'right-2.5', md: 'right-3', lg: 'right-4' };

  const getBorderColor = () => {
    if (error) return 'var(--error)';
    if (isFocused) return 'var(--primary-dark)';
    return 'var(--border)';
  };

  return (
    <div className={`${fullWidth ? 'w-full' : ''} ${className}`}>
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm font-medium mb-1.5"
          style={{ color: 'var(--foreground)' }}
        >
          {label}
        </label>
      )}
      <div className="relative">
        {Icon && (
          <Icon
            size={iconSizes[size]}
            className={`absolute ${iconPositions[size]} top-1/2 -translate-y-1/2 pointer-events-none`}
            style={{ color: 'var(--foreground-muted)' }}
          />
        )}
        <input
          ref={ref}
          id={inputId}
          className={`w-full rounded-lg border outline-none transition-colors ${sizeClasses[size]} ${paddingClasses[size]}`}
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
          aria-describedby={error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined}
          {...props}
        />
        {IconRight && (
          <IconRight
            size={iconSizes[size]}
            className={`absolute ${iconRightPositions[size]} top-1/2 -translate-y-1/2 pointer-events-none`}
            style={{ color: 'var(--foreground-muted)' }}
          />
        )}
      </div>
      {error && (
        <p
          id={`${inputId}-error`}
          className="mt-1.5 text-xs"
          style={{ color: 'var(--error)' }}
        >
          {error}
        </p>
      )}
      {helperText && !error && (
        <p
          id={`${inputId}-helper`}
          className="mt-1.5 text-xs"
          style={{ color: 'var(--foreground-muted)' }}
        >
          {helperText}
        </p>
      )}
    </div>
  );
});

export interface TextareaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'size'> {
  /** Label text */
  label?: string;
  /** Helper text below textarea */
  helperText?: string;
  /** Error message */
  error?: string;
  /** Full width */
  fullWidth?: boolean;
}

/**
 * Textarea - Multi-line text input
 */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  {
    label,
    helperText,
    error,
    fullWidth = true,
    className = '',
    id,
    ...props
  },
  ref
) {
  const [isFocused, setIsFocused] = useState(false);

  const textareaId = id || `textarea-${label?.toLowerCase().replace(/\s+/g, '-')}`;

  const getBorderColor = () => {
    if (error) return 'var(--error)';
    if (isFocused) return 'var(--primary-dark)';
    return 'var(--border)';
  };

  return (
    <div className={`${fullWidth ? 'w-full' : ''} ${className}`}>
      {label && (
        <label
          htmlFor={textareaId}
          className="block text-sm font-medium mb-1.5"
          style={{ color: 'var(--foreground)' }}
        >
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        id={textareaId}
        className="w-full rounded-lg border outline-none transition-colors px-4 py-3 text-sm resize-y min-h-[100px]"
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
        aria-describedby={error ? `${textareaId}-error` : helperText ? `${textareaId}-helper` : undefined}
        {...props}
      />
      {error && (
        <p
          id={`${textareaId}-error`}
          className="mt-1.5 text-xs"
          style={{ color: 'var(--error)' }}
        >
          {error}
        </p>
      )}
      {helperText && !error && (
        <p
          id={`${textareaId}-helper`}
          className="mt-1.5 text-xs"
          style={{ color: 'var(--foreground-muted)' }}
        >
          {helperText}
        </p>
      )}
    </div>
  );
});

export interface FormFieldProps {
  /** Field label */
  label: string;
  /** Field content */
  children: ReactNode;
  /** Helper text */
  helperText?: string;
  /** Error message */
  error?: string;
  /** Required indicator */
  required?: boolean;
  /** Custom className */
  className?: string;
}

/**
 * FormField - Wrapper for form fields with consistent spacing
 */
export function FormField({
  label,
  children,
  helperText,
  error,
  required,
  className = '',
}: FormFieldProps) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <label className="block text-sm font-medium" style={{ color: 'var(--foreground)' }}>
        {label}
        {required && <span style={{ color: 'var(--error)' }}> *</span>}
      </label>
      {children}
      {error && (
        <p className="text-xs" style={{ color: 'var(--error)' }}>
          {error}
        </p>
      )}
      {helperText && !error && (
        <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
          {helperText}
        </p>
      )}
    </div>
  );
}

export interface PasswordInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  /** Label text */
  label?: string;
  /** Helper text */
  helperText?: string;
  /** Error message */
  error?: string;
  /** Size preset */
  size?: 'sm' | 'md' | 'lg';
}

/**
 * PasswordInput - Input with visibility toggle for passwords
 *
 * Usage:
 * ```tsx
 * <PasswordInput
 *   label="Password"
 *   value={password}
 *   onChange={(e) => setPassword(e.target.value)}
 *   placeholder="Enter password"
 * />
 * ```
 */
export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(function PasswordInput(
  {
    label,
    helperText,
    error,
    size = 'md',
    className = '',
    id,
    ...props
  },
  ref
) {
  const [showPassword, setShowPassword] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const inputId = id || `password-${label?.toLowerCase().replace(/\s+/g, '-') || 'input'}`;

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

  const iconSizes = { sm: 14, md: 18, lg: 20 };
  const iconPositions = { sm: 'right-2', md: 'right-3', lg: 'right-4' };

  const getBorderColor = () => {
    if (error) return 'var(--error)';
    if (isFocused) return 'var(--primary-dark)';
    return 'var(--border)';
  };

  return (
    <div className={`w-full ${className}`}>
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm font-medium mb-1.5"
          style={{ color: 'var(--foreground)' }}
        >
          {label}
        </label>
      )}
      <div className="relative">
        <input
          ref={ref}
          id={inputId}
          type={showPassword ? 'text' : 'password'}
          className={`w-full rounded-lg border outline-none transition-colors ${sizeClasses[size]} ${paddingClasses[size]}`}
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
          {...props}
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className={`absolute ${iconPositions[size]} top-1/2 -translate-y-1/2 p-1 rounded hover:bg-[var(--surface-light)]`}
          style={{ color: 'var(--foreground-muted)' }}
          tabIndex={-1}
          aria-label={showPassword ? 'Hide password' : 'Show password'}
        >
          {showPassword ? <EyeOff size={iconSizes[size]} /> : <Eye size={iconSizes[size]} />}
        </button>
      </div>
      {error && (
        <p className="mt-1.5 text-xs" style={{ color: 'var(--error)' }}>
          {error}
        </p>
      )}
      {helperText && !error && (
        <p className="mt-1.5 text-xs" style={{ color: 'var(--foreground-muted)' }}>
          {helperText}
        </p>
      )}
    </div>
  );
});
