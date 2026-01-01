'use client';

import { forwardRef, useState } from 'react';
import type { TopbarColors } from './useTopbarColors';

export interface TopbarTextButtonProps {
  /** Button text content */
  children: string;
  /** Accessible label for the button */
  'aria-label': string;
  /** Tooltip text */
  title?: string;
  /** Click handler */
  onClick?: () => void;
  /** Computed topbar colors (from getTopbarColors) */
  colors: TopbarColors;
  /** Optional: custom className */
  className?: string;
}

/**
 * TopbarTextButton - Text button for topbar (e.g., "Feedback")
 *
 * Usage:
 * ```tsx
 * const colors = getTopbarColors(isLooksListPage);
 * <TopbarTextButton
 *   aria-label="Send feedback"
 *   title="Send Feedback"
 *   colors={colors}
 * >
 *   Feedback
 * </TopbarTextButton>
 * ```
 */
export const TopbarTextButton = forwardRef<HTMLButtonElement, TopbarTextButtonProps>(
  function TopbarTextButton(
    {
      children,
      'aria-label': ariaLabel,
      title,
      onClick,
      colors,
      className = '',
    },
    ref
  ) {
    const [isHovered, setIsHovered] = useState(false);

    return (
      <button
        ref={ref}
        type="button"
        onClick={onClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`h-8 rounded-full flex items-center justify-center px-3 transition-colors ${className}`}
        style={{
          backgroundColor: isHovered ? colors.hoverBg : 'transparent',
          color: isHovered ? colors.text : colors.textMuted,
        }}
        aria-label={ariaLabel}
        title={title}
      >
        <span className="text-xs font-medium">{children}</span>
      </button>
    );
  }
);
