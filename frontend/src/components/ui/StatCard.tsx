'use client';

import { type ReactNode, useState } from 'react';

interface StatCardProps {
  /** Main value to display (number, time, etc.) */
  value: string | number;
  /** Primary label */
  label: string;
  /** Secondary/sublabel text */
  sublabel?: string;
  /** Optional children for custom content (like WeatherWidget) */
  children?: ReactNode;
}

/**
 * StatCard - Elegant stat display card with subtle hover animation
 *
 * Features:
 * - Transparent background with very subtle shadow
 * - No borders, no icons
 * - Hover animation: lift + enhanced shadow + border appears
 * - Cormorant font for values
 */
export function StatCard({ value, label, sublabel, children }: StatCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className="flex items-center gap-4 px-5 py-3 rounded-lg transition-all duration-200 cursor-default"
      style={{
        backgroundColor: 'transparent',
        boxShadow: isHovered
          ? '0 8px 25px -5px rgba(0, 0, 0, 0.12), 0 0 0 1px var(--primary-dark)'
          : '0 2px 8px -2px rgba(0, 0, 0, 0.06)',
        transform: isHovered ? 'translateY(-2px)' : 'none',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {children ? (
        children
      ) : (
        <>
          <span
            className="text-2xl"
            style={{
              color: 'var(--foreground)',
              fontFamily: 'var(--font-cormorant)',
              fontWeight: 400,
              lineHeight: 1,
            }}
          >
            {value}
          </span>
          <div className="flex flex-col">
            <span
              className="text-sm font-medium"
              style={{ color: 'var(--foreground)', lineHeight: 1.2 }}
            >
              {label}
            </span>
            {sublabel && (
              <span
                className="text-xs"
                style={{ color: 'var(--foreground-muted)' }}
              >
                {sublabel}
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * StatDivider - Very faint vertical divider between stat cards
 */
export function StatDivider() {
  return (
    <div
      className="h-8 w-px"
      style={{ backgroundColor: 'var(--border)', opacity: 0.4 }}
    />
  );
}

export default StatCard;
