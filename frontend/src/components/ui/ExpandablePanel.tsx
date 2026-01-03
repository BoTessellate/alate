'use client';

import {
  useState,
  useEffect,
  useRef,
  type ReactNode,
  type CSSProperties,
} from 'react';
import { X, ChevronUp, ChevronDown } from 'lucide-react';

export interface ExpandablePanelProps {
  /** Whether the panel is open */
  isOpen: boolean;
  /** Callback when panel should close */
  onClose: () => void;
  /** Panel content */
  children: ReactNode;
  /** Panel title for header */
  title?: string;
  /** Optional subtitle */
  subtitle?: string;
  /** Whether clicking backdrop closes panel */
  closeOnBackdropClick?: boolean;
  /** Whether pressing Escape closes panel */
  closeOnEscape?: boolean;
  /** Custom className for panel container */
  className?: string;
  /** Initial mode */
  initialMode?: 'compact' | 'expanded';
  /** Callback when mode changes */
  onModeChange?: (mode: 'compact' | 'expanded') => void;
  /** Test ID for testing */
  'data-testid'?: string;
  /** Header actions (rendered between title and expand/close buttons) */
  headerActions?: ReactNode;
}

/**
 * ExpandablePanel - A panel that can toggle between compact (modal) and expanded (full side panel) modes
 *
 * Features:
 * - Compact mode: Floating card in bottom-right corner
 * - Expanded mode: Full-height side panel on the right
 * - Smooth transitions between modes
 * - Keyboard navigation (Escape to close)
 * - Click-outside to close (optional)
 * - Focus trapping
 *
 * Usage:
 * ```tsx
 * <ExpandablePanel
 *   isOpen={showPanel}
 *   onClose={() => setShowPanel(false)}
 *   title="AI Assistant"
 * >
 *   <ChatInterface />
 * </ExpandablePanel>
 * ```
 */
export function ExpandablePanel({
  isOpen,
  onClose,
  children,
  title,
  subtitle,
  closeOnBackdropClick = true,
  closeOnEscape = true,
  className = '',
  initialMode = 'compact',
  onModeChange,
  'data-testid': testId,
  headerActions,
}: ExpandablePanelProps) {
  const [mode, setMode] = useState<'compact' | 'expanded'>(initialMode);
  const panelRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  const isCompact = mode === 'compact';
  const isExpanded = mode === 'expanded';

  // Handle mode toggle
  const toggleMode = () => {
    const newMode = isCompact ? 'expanded' : 'compact';
    setMode(newMode);
    onModeChange?.(newMode);
  };

  // Handle Escape key
  useEffect(() => {
    if (!isOpen || !closeOnEscape) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, closeOnEscape, onClose]);

  // Focus management
  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement as HTMLElement;
      panelRef.current?.focus();
    } else {
      previousActiveElement.current?.focus();
    }
  }, [isOpen]);

  // Focus trap - keep focus within panel
  useEffect(() => {
    if (!isOpen) return;

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !panelRef.current) return;

      const focusableElements = panelRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement?.focus();
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement?.focus();
      }
    };

    document.addEventListener('keydown', handleTabKey);
    return () => document.removeEventListener('keydown', handleTabKey);
  }, [isOpen]);

  // Prevent body scroll when expanded
  useEffect(() => {
    if (isOpen && isExpanded) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, isExpanded]);

  // Reset mode when closed
  useEffect(() => {
    if (!isOpen) {
      setMode(initialMode);
    }
  }, [isOpen, initialMode]);

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (closeOnBackdropClick && e.target === e.currentTarget) {
      onClose();
    }
  };

  // Compact mode styles (floating bubble in bottom-right)
  const compactStyles: CSSProperties = {
    position: 'fixed',
    bottom: '96px',
    right: '24px',
    width: '400px',
    maxWidth: 'calc(100vw - 48px)',
    height: 'auto',
    minHeight: '320px',
    maxHeight: '70vh',
    borderRadius: '16px',
    zIndex: 50,
  };

  // Expanded mode styles (full-height side panel attached to right edge)
  const expandedStyles: CSSProperties = {
    position: 'fixed',
    top: 0,
    right: 0,
    bottom: 0,
    width: '480px',
    maxWidth: '100vw',
    borderRadius: 0,
    borderLeft: '1px solid var(--border)',
    zIndex: 60,
  };

  const panelStyles = isCompact ? compactStyles : expandedStyles;

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 transition-all duration-300 ${
          isExpanded ? 'bg-black/50 backdrop-blur-sm' : 'bg-black/30'
        }`}
        onClick={handleBackdropClick}
        data-testid={testId ? `${testId}-backdrop` : undefined}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'panel-title' : undefined}
        tabIndex={-1}
        data-testid={testId}
        className={`flex flex-col border shadow-xl overflow-hidden transition-all duration-300 ease-out ${className}`}
        style={{
          backgroundColor: 'var(--surface)',
          borderColor: 'var(--border)',
          ...panelStyles,
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0"
          style={{ borderColor: 'var(--border)' }}
        >
          {/* Expand/Collapse button - LEFT side with chevron up/down */}
          <button
            onClick={toggleMode}
            className="w-8 h-8 rounded-full flex items-center justify-center transition-colors flex-shrink-0"
            style={{ color: 'var(--foreground-muted)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--surface-light)';
              e.currentTarget.style.color = 'var(--foreground)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = 'var(--foreground-muted)';
            }}
            aria-label={isCompact ? 'Expand panel' : 'Collapse panel'}
            data-testid={testId ? `${testId}-toggle` : undefined}
            title={isCompact ? 'Expand to full panel' : 'Collapse to bubble'}
          >
            {isCompact ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>

          {/* Title section */}
          <div className="flex-1 min-w-0 mx-3">
            {title && (
              <h2
                id="panel-title"
                className="text-lg italic truncate"
                style={{
                  fontFamily: 'var(--font-cormorant)',
                  fontWeight: 500,
                  color: 'var(--foreground)',
                }}
              >
                {title}
              </h2>
            )}
            {subtitle && (
              <p
                className="text-xs mt-0.5 truncate"
                style={{ color: 'var(--foreground-muted)' }}
              >
                {subtitle}
              </p>
            )}
          </div>

          {/* Header Actions */}
          {headerActions && (
            <div className="flex items-center gap-1 mx-2">
              {headerActions}
            </div>
          )}

          {/* Close button - RIGHT side */}
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center transition-colors flex-shrink-0"
            style={{ color: 'var(--foreground-muted)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--surface-light)';
              e.currentTarget.style.color = 'var(--foreground)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = 'var(--foreground-muted)';
            }}
            aria-label="Close panel"
            data-testid={testId ? `${testId}-close` : undefined}
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {children}
        </div>
      </div>
    </>
  );
}

export default ExpandablePanel;
