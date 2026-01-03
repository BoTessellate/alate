'use client';

import { forwardRef, useState, type ReactNode, type ButtonHTMLAttributes, type ComponentType } from 'react';
import { Loader2, type LucideIcon, type LucideProps } from 'lucide-react';

/** Icon can be a Lucide icon or a render function returning JSX */
export type IconProp = LucideIcon | ComponentType<LucideProps> | (() => ReactNode);

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual variant */
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline' | 'destructive' | 'link';
  /** Size preset */
  size?: 'sm' | 'md' | 'lg';
  /** Icon to display before text (Lucide icon or render function) */
  icon?: IconProp;
  /** Icon to display after text */
  iconRight?: LucideIcon;
  /** Loading state */
  loading?: boolean;
  /** Full width */
  fullWidth?: boolean;
  /** Children content */
  children?: ReactNode;
}

/**
 * Button - Reusable button component with variants
 *
 * Variants:
 * - primary: Green background (CTA)
 * - secondary: Surface background with border
 * - ghost: Transparent, shows on hover
 * - outline: Border only
 * - destructive: Red for dangerous actions
 * - link: Text link style
 *
 * Usage:
 * ```tsx
 * <Button variant="primary" icon={Plus} onClick={handleAdd}>
 *   Add Item
 * </Button>
 *
 * <Button variant="ghost" size="sm" loading>
 *   Saving...
 * </Button>
 * ```
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    icon: Icon,
    iconRight: IconRight,
    loading = false,
    fullWidth = false,
    children,
    disabled,
    className = '',
    ...props
  },
  ref
) {
  const [isHovered, setIsHovered] = useState(false);

  const isDisabled = disabled || loading;

  // Size classes
  const sizeClasses = {
    sm: 'h-8 px-3 text-xs gap-1.5',
    md: 'h-10 px-4 text-sm gap-2',
    lg: 'h-12 px-6 text-base gap-2.5',
  };

  const iconSizes = {
    sm: 14,
    md: 16,
    lg: 18,
  };

  // Variant styles
  const getVariantStyles = () => {
    const baseStyles = {
      backgroundColor: 'transparent',
      color: 'var(--foreground)',
      borderColor: 'transparent',
    };

    switch (variant) {
      case 'primary':
        return {
          backgroundColor: isHovered && !isDisabled ? 'var(--primary)' : 'var(--primary-dark)',
          color: 'white',
          borderColor: 'transparent',
        };
      case 'secondary':
        return {
          backgroundColor: isHovered && !isDisabled ? 'var(--surface-light)' : 'var(--surface)',
          color: 'var(--foreground)',
          borderColor: isHovered && !isDisabled ? 'var(--primary)' : 'var(--border)',
        };
      case 'ghost':
        return {
          backgroundColor: isHovered && !isDisabled ? 'var(--surface-light)' : 'transparent',
          color: isHovered && !isDisabled ? 'var(--foreground)' : 'var(--foreground-secondary)',
          borderColor: 'transparent',
        };
      case 'outline':
        return {
          backgroundColor: 'transparent',
          color: isHovered && !isDisabled ? 'var(--primary)' : 'var(--foreground)',
          borderColor: isHovered && !isDisabled ? 'var(--primary)' : 'var(--border)',
        };
      case 'destructive':
        return {
          backgroundColor: isHovered && !isDisabled ? 'var(--error)' : 'rgba(168, 64, 50, 0.1)',
          color: isHovered && !isDisabled ? 'white' : 'var(--error)',
          borderColor: 'transparent',
        };
      case 'link':
        return {
          backgroundColor: 'transparent',
          color: isHovered && !isDisabled ? 'var(--primary-dark)' : 'var(--primary)',
          borderColor: 'transparent',
        };
      default:
        return baseStyles;
    }
  };

  const styles = getVariantStyles();

  const baseClasses = [
    'inline-flex items-center justify-center font-medium rounded-lg border transition-all duration-200',
    // Suppress browser focus ring - we use hover/active states for visual feedback
    'outline-none focus:outline-none focus-visible:outline-none',
    sizeClasses[size],
    fullWidth ? 'w-full' : '',
    isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
    variant === 'link' ? 'underline-offset-4 hover:underline' : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <button
      ref={ref}
      disabled={isDisabled}
      className={baseClasses}
      style={{
        backgroundColor: styles.backgroundColor,
        color: styles.color,
        borderColor: styles.borderColor,
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      {...props}
    >
      {loading ? (
        <Loader2 size={iconSizes[size]} className="animate-spin" />
      ) : Icon ? (
        // Check if icon is a render function (returns ReactNode) or a component
        typeof Icon === 'function' && Icon.length === 0 ? (
          (Icon as () => ReactNode)()
        ) : (
          <Icon size={iconSizes[size]} />
        )
      ) : null}
      {children}
      {IconRight && !loading && <IconRight size={iconSizes[size]} />}
    </button>
  );
});

/**
 * IconButton props - explicitly allows render functions for icons
 */
export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  /** Icon component or render function */
  icon?: LucideIcon | (() => ReactNode);
  /** Visual variant */
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline' | 'destructive' | 'link';
  /** Size preset */
  size?: 'sm' | 'md' | 'lg';
  /** Accessibility label (required) */
  'aria-label': string;
}

/**
 * IconButton - Square icon-only button
 *
 * Supports custom styling via className and style props.
 * When custom styles are provided, they override the variant styles.
 */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon: Icon, size = 'md', variant = 'ghost', className = '', style, ...props },
  ref
) {
  const [isHovered, setIsHovered] = useState(false);

  const sizeClasses = {
    sm: 'w-7 h-7',
    md: 'w-8 h-8',
    lg: 'w-10 h-10',
  };

  const iconSizes = {
    sm: 14,
    md: 16,
    lg: 20,
  };

  const getStyles = () => {
    if (variant === 'primary') {
      return {
        backgroundColor: isHovered ? 'var(--primary)' : 'var(--primary-dark)',
        color: 'white',
      };
    }
    return {
      backgroundColor: isHovered ? 'var(--surface-light)' : 'transparent',
      color: isHovered ? 'var(--foreground)' : 'var(--foreground-muted)',
    };
  };

  const baseStyles = getStyles();
  // Merge custom style with base styles, custom style takes precedence
  const mergedStyles = style ? { ...baseStyles, ...style } : baseStyles;

  // Build className - custom className can override size classes
  const hasCustomSize = className.includes('w-') || className.includes('h-');
  const baseClassName = hasCustomSize
    ? 'rounded-full flex items-center justify-center transition-colors outline-none focus:outline-none focus-visible:outline-none'
    : `${sizeClasses[size]} rounded-full flex items-center justify-center transition-colors outline-none focus:outline-none focus-visible:outline-none`;

  return (
    <button
      ref={ref}
      className={`${baseClassName} ${className}`.trim()}
      style={mergedStyles}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      {...props}
    >
      {Icon && (
        // Check if icon is a render function (returns ReactNode) or a component
        typeof Icon === 'function' && Icon.length === 0 ? (
          (Icon as () => ReactNode)()
        ) : (
          <Icon size={iconSizes[size]} />
        )
      )}
    </button>
  );
});
