'use client';

import { forwardRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { TopbarColors } from './useTopbarColors';

export interface TopbarIconButtonProps {
  /** The Lucide icon to display */
  icon: LucideIcon;
  /** Accessible label for the button */
  'aria-label': string;
  /** Tooltip text */
  title?: string;
  /** Click handler */
  onClick?: () => void;
  /** Computed topbar colors (from getTopbarColors) */
  colors: TopbarColors;
  /** Optional: override default background with filled style */
  variant?: 'ghost' | 'filled';
  /** Optional: aria-expanded for dropdown triggers */
  'aria-expanded'?: boolean;
  /** Optional: aria-haspopup for dropdown triggers */
  'aria-haspopup'?: 'menu' | 'listbox' | 'dialog' | boolean;
  /** Optional: aria-pressed for toggle buttons */
  'aria-pressed'?: boolean;
  /** Optional: custom className */
  className?: string;
}

/**
 * TopbarIconButton - Consistent icon button for topbar
 *
 * Usage:
 * ```tsx
 * const colors = getTopbarColors(isLooksListPage);
 * <TopbarIconButton
 *   icon={Search}
 *   aria-label="Search"
 *   title="Search (Ctrl+K)"
 *   onClick={() => setShowSearch(true)}
 *   colors={colors}
 * />
 * ```
 */
export const TopbarIconButton = forwardRef<HTMLButtonElement, TopbarIconButtonProps>(
  function TopbarIconButton(
    {
      icon: Icon,
      'aria-label': ariaLabel,
      title,
      onClick,
      colors,
      variant = 'ghost',
      'aria-expanded': ariaExpanded,
      'aria-haspopup': ariaHaspopup,
      'aria-pressed': ariaPressed,
      className = '',
    },
    ref
  ) {
    const [isHovered, setIsHovered] = useState(false);

    const backgroundColor =
      variant === 'filled'
        ? isHovered
          ? colors.hoverBg
          : colors.activeBg
        : isHovered
        ? colors.hoverBg
        : colors.defaultBg;

    const textColor = isHovered ? colors.text : colors.textMuted;

    return (
      <button
        ref={ref}
        type="button"
        onClick={onClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${className}`}
        style={{
          backgroundColor,
          color: textColor,
        }}
        aria-label={ariaLabel}
        aria-expanded={ariaExpanded}
        aria-haspopup={ariaHaspopup}
        aria-pressed={ariaPressed}
        title={title}
      >
        <Icon size={16} aria-hidden="true" />
      </button>
    );
  }
);
