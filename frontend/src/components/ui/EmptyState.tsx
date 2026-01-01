'use client';

import type { ReactNode } from 'react';
import { type LucideIcon } from 'lucide-react';
import { Button, type ButtonProps } from './Button';

export interface EmptyStateProps {
  /** Icon to display */
  icon?: LucideIcon;
  /** Title text */
  title: string;
  /** Description text */
  description?: string;
  /** Primary action button */
  action?: {
    label: string;
    onClick: () => void;
    icon?: LucideIcon;
    variant?: ButtonProps['variant'];
  };
  /** Secondary action */
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  /** Custom content below description */
  children?: ReactNode;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Custom className */
  className?: string;
}

/**
 * EmptyState - Placeholder for empty lists/sections
 *
 * Usage:
 * ```tsx
 * <EmptyState
 *   icon={Layers}
 *   title="No moodboards yet"
 *   description="Create your first moodboard to get started"
 *   action={{
 *     label: "Create Moodboard",
 *     onClick: handleCreate,
 *     icon: Plus
 *   }}
 * />
 * ```
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  children,
  size = 'md',
  className = '',
}: EmptyStateProps) {
  const sizeStyles = {
    sm: {
      container: 'py-8',
      icon: 32,
      title: 'text-lg',
      description: 'text-xs',
    },
    md: {
      container: 'py-12',
      icon: 48,
      title: 'text-2xl',
      description: 'text-sm',
    },
    lg: {
      container: 'py-20',
      icon: 64,
      title: 'text-3xl',
      description: 'text-base',
    },
  };

  const styles = sizeStyles[size];

  return (
    <div
      className={`text-center rounded-lg border ${styles.container} ${className}`}
      style={{
        backgroundColor: 'var(--surface)',
        borderColor: 'var(--border)',
      }}
    >
      {Icon && (
        <div className="flex justify-center mb-4">
          <Icon
            size={styles.icon}
            style={{ color: 'var(--foreground-muted)' }}
          />
        </div>
      )}
      <h3
        className={`${styles.title} italic`}
        style={{
          fontFamily: 'var(--font-cormorant)',
          fontWeight: 500,
          color: 'var(--foreground)',
        }}
      >
        {title}
      </h3>
      {description && (
        <p
          className={`${styles.description} mt-2 max-w-md mx-auto`}
          style={{
            fontFamily: 'var(--font-cormorant)',
            color: 'var(--foreground-muted)',
            letterSpacing: '0.02em',
          }}
        >
          {description}
        </p>
      )}
      {children && <div className="mt-4">{children}</div>}
      {(action || secondaryAction) && (
        <div className="flex items-center justify-center gap-3 mt-6">
          {action && (
            <Button
              variant={action.variant || 'primary'}
              icon={action.icon}
              onClick={action.onClick}
            >
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button variant="ghost" onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * InlineEmptyState - Compact empty state for smaller areas
 */
export function InlineEmptyState({
  icon: Icon,
  message,
  action,
  className = '',
}: {
  icon?: LucideIcon;
  message: string;
  action?: { label: string; onClick: () => void };
  className?: string;
}) {
  return (
    <div
      className={`flex items-center justify-center gap-3 py-8 ${className}`}
      style={{ color: 'var(--foreground-muted)' }}
    >
      {Icon && <Icon size={20} />}
      <span className="text-sm">{message}</span>
      {action && (
        <Button variant="link" size="sm" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}
