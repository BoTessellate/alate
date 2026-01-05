'use client';

import {
  useState,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';
import { ChevronDown, Check } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  icon?: ReactNode;
}

export interface SelectDropdownProps {
  /** Label text */
  label?: string;
  /** Currently selected value */
  value: string;
  /** Available options */
  options: SelectOption[];
  /** Change handler */
  onChange: (value: string) => void;
  /** Placeholder when no value selected */
  placeholder?: string;
  /** Helper text below select */
  helperText?: string;
  /** Error message (shows error state) */
  error?: string;
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
 * SelectDropdown - Custom styled dropdown select with smooth animations
 *
 * Usage:
 * ```tsx
 * <SelectDropdown
 *   label="Currency"
 *   value={currency}
 *   onChange={setCurrency}
 *   options={[
 *     { value: 'USD', label: 'USD' },
 *     { value: 'EUR', label: 'EUR' },
 *   ]}
 * />
 * ```
 */
export function SelectDropdown({
  label,
  value,
  options,
  onChange,
  placeholder = 'Select...',
  helperText,
  error,
  size = 'md',
  fullWidth = true,
  className = '',
  disabled = false,
}: SelectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const selectId = `select-dropdown-${label?.toLowerCase().replace(/\s+/g, '-') || 'unnamed'}`;

  // Find selected option
  const selectedOption = options.find(opt => opt.value === value);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setIsFocused(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

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
    if (isFocused || isOpen) return 'var(--primary-dark)';
    return 'var(--border)';
  };

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setIsOpen(!isOpen);
    } else if (e.key === 'ArrowDown' && !isOpen) {
      e.preventDefault();
      setIsOpen(true);
    }
  };

  return (
    <div ref={containerRef} className={`${fullWidth ? 'w-full' : ''} ${className}`}>
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
        <button
          ref={triggerRef}
          id={selectId}
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => !isOpen && setIsFocused(false)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          className={`w-full rounded-lg border outline-none cursor-pointer text-left ${sizeClasses[size]} ${paddingClasses[size]}`}
          style={{
            backgroundColor: 'var(--background)',
            borderColor: getBorderColor(),
            color: selectedOption ? 'var(--foreground)' : 'var(--foreground-muted)',
            boxShadow: isFocused || isOpen ? 'var(--shadow-md)' : 'none',
            transition: 'all var(--transition-base) var(--ease-out)',
            opacity: disabled ? 0.5 : 1,
            cursor: disabled ? 'not-allowed' : 'pointer',
          }}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-invalid={!!error}
          aria-describedby={error ? `${selectId}-error` : helperText ? `${selectId}-helper` : undefined}
        >
          <span className="flex items-center gap-2">
            {selectedOption?.icon}
            {selectedOption?.label || placeholder}
          </span>
        </button>
        <ChevronDown
          size={iconSizes[size]}
          className={`absolute ${iconPositions[size]} top-1/2 -translate-y-1/2 pointer-events-none transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          style={{ color: 'var(--foreground-muted)' }}
        />

        {/* Dropdown Menu */}
        {isOpen && (
          <div
            role="listbox"
            className="absolute top-full left-0 right-0 mt-1 py-1 rounded-lg border overflow-hidden z-50"
            style={{
              backgroundColor: 'var(--surface)',
              borderColor: 'var(--border)',
              boxShadow: 'var(--shadow-lg)',
              animation: 'selectDropdownIn var(--transition-base) var(--ease-out)',
            }}
          >
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={option.value === value}
                onClick={() => handleSelect(option.value)}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm transition-colors text-left outline-none focus:outline-none hover:bg-[var(--surface-light)]"
                style={{
                  backgroundColor: option.value === value ? 'var(--surface-light)' : 'transparent',
                  color: 'var(--foreground)',
                }}
              >
                <span className="flex items-center gap-2">
                  {option.icon}
                  {option.label}
                </span>
                {option.value === value && (
                  <Check size={14} style={{ color: 'var(--primary-dark)' }} />
                )}
              </button>
            ))}
          </div>
        )}
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

      {/* CSS Animation */}
      <style jsx>{`
        @keyframes selectDropdownIn {
          from {
            opacity: 0;
            transform: translateY(-4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
