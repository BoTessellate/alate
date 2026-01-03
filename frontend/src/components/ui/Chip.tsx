'use client';

import { forwardRef, useState, type ReactNode, type MouseEvent } from 'react';
import { X, type LucideIcon } from 'lucide-react';

export interface ChipProps {
  /** Content of the chip */
  children: ReactNode;
  /** Visual variant */
  variant?: 'default' | 'selected' | 'outline';
  /** Size preset */
  size?: 'sm' | 'md' | 'lg';
  /** Leading icon */
  icon?: LucideIcon;
  /** Click handler - makes the chip interactive/clickable */
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
  /** Remove handler - shows X button to remove */
  onRemove?: (e: MouseEvent<HTMLButtonElement>) => void;
  /** Disabled state */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Test ID */
  'data-testid'?: string;
}

/**
 * Chip - Compact element for tags, filters, and selections
 *
 * Variants:
 * - default: Subtle surface background
 * - selected: Primary background indicating selection
 * - outline: Border only, transparent background
 *
 * Usage:
 * ```tsx
 * // Simple tag
 * <Chip>Fashion</Chip>
 *
 * // Selectable chip (for tag selection)
 * <Chip
 *   variant={isSelected ? 'selected' : 'default'}
 *   onClick={() => toggleSelection(id)}
 * >
 *   Minimalist
 * </Chip>
 *
 * // Removable chip (for active filters)
 * <Chip
 *   variant="selected"
 *   onRemove={() => removeFilter(id)}
 * >
 *   Under $100
 * </Chip>
 *
 * // With icon
 * <Chip icon={Tag} variant="outline">
 *   New Arrival
 * </Chip>
 * ```
 */
export const Chip = forwardRef<HTMLButtonElement, ChipProps>(function Chip(
  {
    children,
    variant = 'default',
    size = 'md',
    icon: Icon,
    onClick,
    onRemove,
    disabled = false,
    className = '',
    'data-testid': testId,
  },
  ref
) {
  const [isHovered, setIsHovered] = useState(false);

  const isClickable = !!onClick;
  const isRemovable = !!onRemove;

  // Size classes
  const sizeClasses = {
    sm: 'h-6 px-2 text-xs gap-1',
    md: 'h-7 px-3 text-sm gap-1.5',
    lg: 'h-8 px-4 text-sm gap-2',
  };

  const iconSizes = {
    sm: 12,
    md: 14,
    lg: 16,
  };

  const removeButtonSizes = {
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
    lg: 'w-4.5 h-4.5',
  };

  // Variant styles
  const getVariantStyles = () => {
    switch (variant) {
      case 'selected':
        return {
          backgroundColor: isHovered && isClickable && !disabled
            ? 'var(--primary)'
            : 'var(--primary-dark)',
          color: 'white',
          borderColor: 'transparent',
        };
      case 'outline':
        return {
          backgroundColor: isHovered && isClickable && !disabled
            ? 'var(--surface-light)'
            : 'transparent',
          color: isHovered && isClickable && !disabled
            ? 'var(--foreground)'
            : 'var(--foreground-secondary)',
          borderColor: isHovered && isClickable && !disabled
            ? 'var(--primary-dark)'
            : 'var(--border)',
        };
      case 'default':
      default:
        return {
          backgroundColor: isHovered && isClickable && !disabled
            ? 'var(--surface-light)'
            : 'var(--surface)',
          color: 'var(--foreground)',
          borderColor: isHovered && isClickable && !disabled
            ? 'var(--primary-dark)'
            : 'var(--border)',
        };
    }
  };

  const styles = getVariantStyles();

  const baseClasses = [
    'inline-flex items-center justify-center font-medium rounded-full border transition-all duration-200',
    'outline-none focus:outline-none focus-visible:outline-none',
    sizeClasses[size],
    disabled ? 'opacity-50 cursor-not-allowed' : isClickable ? 'cursor-pointer' : 'cursor-default',
    className,
  ].filter(Boolean).join(' ');

  const handleRemove = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (!disabled && onRemove) {
      onRemove(e);
    }
  };

  // Determine element type and accessibility props
  const accessibilityProps = isClickable
    ? {
        role: 'button' as const,
        'aria-pressed': variant === 'selected',
        'aria-disabled': disabled,
      }
    : {};

  // If clickable, render as button; otherwise as span
  if (isClickable) {
    return (
      <button
        ref={ref}
        type="button"
        disabled={disabled}
        className={baseClasses}
        style={{
          backgroundColor: styles.backgroundColor,
          color: styles.color,
          borderColor: styles.borderColor,
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={onClick}
        data-testid={testId}
        {...accessibilityProps}
      >
        {Icon && <Icon size={iconSizes[size]} />}
        <span>{children}</span>
        {isRemovable && (
          <button
            type="button"
            onClick={handleRemove}
            disabled={disabled}
            className={`${removeButtonSizes[size]} rounded-full flex items-center justify-center transition-colors outline-none focus:outline-none hover:bg-white/20`}
            style={{
              color: variant === 'selected' ? 'white' : 'var(--foreground-muted)',
            }}
            aria-label="Remove"
          >
            <X size={iconSizes[size] - 2} />
          </button>
        )}
      </button>
    );
  }

  // Non-clickable chip (display only)
  return (
    <span
      className={baseClasses}
      style={{
        backgroundColor: styles.backgroundColor,
        color: styles.color,
        borderColor: styles.borderColor,
      }}
      data-testid={testId}
    >
      {Icon && <Icon size={iconSizes[size]} />}
      <span>{children}</span>
      {isRemovable && (
        <button
          type="button"
          onClick={handleRemove}
          disabled={disabled}
          className={`${removeButtonSizes[size]} rounded-full flex items-center justify-center transition-colors outline-none focus:outline-none hover:bg-black/10`}
          style={{
            color: variant === 'selected' ? 'white' : 'var(--foreground-muted)',
          }}
          aria-label="Remove"
        >
          <X size={iconSizes[size] - 2} />
        </button>
      )}
    </span>
  );
});
