'use client';

import { forwardRef, useState, type ReactNode, type CSSProperties } from 'react';

export interface CardProps {
  /** Card content */
  children: ReactNode;
  /** Visual variant */
  variant?: 'default' | 'interactive' | 'elevated';
  /** Optional click handler (makes card interactive) */
  onClick?: () => void;
  /** Whether to show hover border highlight */
  hoverHighlight?: boolean;
  /** Custom className */
  className?: string;
  /** Custom inline styles */
  style?: CSSProperties;
  /** Padding preset */
  padding?: 'none' | 'sm' | 'md' | 'lg';
  /** As element type */
  as?: 'div' | 'article' | 'section';
}

const paddingMap = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
};

/**
 * Card - Reusable card/surface component
 *
 * Variants:
 * - default: Simple bordered card
 * - interactive: Hover effects for clickable cards
 * - elevated: Shadow + hover lift effect
 *
 * Usage:
 * ```tsx
 * <Card variant="interactive" onClick={() => navigate('/item')}>
 *   <CardContent />
 * </Card>
 * ```
 */
export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  {
    children,
    variant = 'default',
    onClick,
    hoverHighlight = true,
    className = '',
    style,
    padding = 'none',
    as: Component = 'div',
  },
  ref
) {
  const [isHovered, setIsHovered] = useState(false);

  const isInteractive = variant === 'interactive' || variant === 'elevated' || !!onClick;

  const baseStyles: CSSProperties = {
    backgroundColor: 'var(--surface)',
    borderColor: isHovered && hoverHighlight ? 'var(--primary-dark)' : 'var(--border)',
    // Enhanced lift: -4px for bolder hover effect
    transform: variant === 'elevated' && isHovered ? 'var(--lift-md)' : 'translateY(0)',
    // Enhanced shadows using CSS variables
    boxShadow: variant === 'elevated'
      ? isHovered
        ? 'var(--shadow-elevated-hover)'
        : 'var(--shadow-elevated)'
      : undefined,
    cursor: isInteractive ? 'pointer' : undefined,
    transition: 'all var(--transition-base) var(--ease-out)',
    ...style,
  };

  const baseClasses = [
    'rounded-lg border overflow-hidden transition-all duration-200',
    // Suppress browser focus ring - we use border color for focus indication
    'outline-none focus:outline-none focus-visible:outline-none',
    paddingMap[padding],
    className,
  ].filter(Boolean).join(' ');

  return (
    <Component
      ref={ref}
      className={baseClasses}
      style={baseStyles}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      } : undefined}
    >
      {children}
    </Component>
  );
});

/**
 * CardHeader - Optional header section with border
 */
export function CardHeader({
  children,
  className = '',
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={`px-4 py-3 border-b ${className}`}
      style={{ borderColor: 'var(--border)', ...style }}
    >
      {children}
    </div>
  );
}

/**
 * CardContent - Main content area with padding
 */
export function CardContent({
  children,
  className = ''
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`p-4 ${className}`}>
      {children}
    </div>
  );
}

/**
 * CardFooter - Optional footer section with border
 */
export function CardFooter({
  children,
  className = ''
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`px-4 py-3 border-t ${className}`}
      style={{ borderColor: 'var(--border)' }}
    >
      {children}
    </div>
  );
}
