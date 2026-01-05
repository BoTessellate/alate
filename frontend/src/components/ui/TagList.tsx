'use client';

import { useState } from 'react';
import { X } from 'lucide-react';

export interface TagListProps {
  /** Label text */
  label?: string;
  /** Array of tags to display */
  tags: string[];
  /** Callback when a tag is removed (if provided, tags are removable) */
  onRemove?: (tag: string) => void;
  /** Size preset */
  size?: 'sm' | 'md' | 'lg';
  /** Custom className */
  className?: string;
  /** Empty state message */
  emptyMessage?: string;
}

/**
 * TagList - Display a list of tags with optional remove functionality
 *
 * Usage:
 * ```tsx
 * <TagList
 *   label="Tags"
 *   tags={['casual', 'summer', 'cotton']}
 *   onRemove={(tag) => handleRemoveTag(tag)}
 * />
 * ```
 */
export function TagList({
  label,
  tags,
  onRemove,
  size = 'md',
  className = '',
  emptyMessage,
}: TagListProps) {
  const [hoveredTag, setHoveredTag] = useState<string | null>(null);

  const sizeClasses = {
    sm: 'px-1.5 py-0.5 text-xs',
    md: 'px-2 py-1 text-xs',
    lg: 'px-3 py-1.5 text-sm',
  };

  const iconSizes = { sm: 10, md: 12, lg: 14 };

  if (tags.length === 0 && emptyMessage) {
    return (
      <div className={className}>
        {label && (
          <span
            className="text-sm font-medium mb-2 block"
            style={{ color: 'var(--foreground)' }}
          >
            {label}
          </span>
        )}
        <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
          {emptyMessage}
        </p>
      </div>
    );
  }

  return (
    <div className={className}>
      {label && (
        <span
          className="text-sm font-medium mb-2 block"
          style={{ color: 'var(--foreground)' }}
        >
          {label}
        </span>
      )}
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <span
            key={tag}
            className={`inline-flex items-center gap-1 rounded-full ${sizeClasses[size]}`}
            style={{
              backgroundColor: 'var(--primary-dark)',
              color: 'white',
              transition: 'all var(--transition-base) var(--ease-out)',
              transform: hoveredTag === tag && onRemove ? 'var(--lift-sm)' : 'none',
            }}
            onMouseEnter={() => setHoveredTag(tag)}
            onMouseLeave={() => setHoveredTag(null)}
          >
            {tag}
            {onRemove && (
              <button
                type="button"
                onClick={() => onRemove(tag)}
                aria-label={`Remove tag ${tag}`}
                className="cursor-pointer"
                style={{
                  transition: 'opacity var(--transition-base) var(--ease-out)',
                  opacity: hoveredTag === tag ? 0.7 : 1,
                }}
              >
                <X size={iconSizes[size]} aria-hidden="true" />
              </button>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}
