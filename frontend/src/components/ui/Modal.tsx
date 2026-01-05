'use client';

import {
  useEffect,
  useRef,
  type ReactNode,
  type CSSProperties,
} from 'react';
import { X } from 'lucide-react';

export interface ModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback when modal should close */
  onClose: () => void;
  /** Modal content */
  children: ReactNode;
  /** Modal title for header */
  title?: string;
  /** Optional subtitle */
  subtitle?: string;
  /** Size preset */
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  /** Whether clicking backdrop closes modal */
  closeOnBackdropClick?: boolean;
  /** Whether pressing Escape closes modal */
  closeOnEscape?: boolean;
  /** Show close button in header */
  showCloseButton?: boolean;
  /** Custom className for modal container */
  className?: string;
  /** Position on screen */
  position?: 'center' | 'top' | 'right';
  /** Test ID for testing */
  'data-testid'?: string;
}

const sizeClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  full: 'max-w-4xl',
};

/**
 * Modal - Accessible dialog component
 *
 * Features:
 * - Keyboard navigation (Escape to close)
 * - Click-outside to close
 * - Focus trapping
 * - ARIA attributes
 *
 * Usage:
 * ```tsx
 * <Modal
 *   isOpen={showModal}
 *   onClose={() => setShowModal(false)}
 *   title="Confirm Action"
 * >
 *   <p>Are you sure?</p>
 *   <Button onClick={handleConfirm}>Confirm</Button>
 * </Modal>
 * ```
 */
export function Modal({
  isOpen,
  onClose,
  children,
  title,
  subtitle,
  size = 'md',
  closeOnBackdropClick = true,
  closeOnEscape = true,
  showCloseButton = true,
  className = '',
  position = 'center',
  'data-testid': testId,
}: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

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

  // Focus management and focus trapping
  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement as HTMLElement;
      modalRef.current?.focus();
    } else if (previousActiveElement.current) {
      previousActiveElement.current.focus();
    }
  }, [isOpen]);

  // Focus trap - keep focus within modal
  useEffect(() => {
    if (!isOpen) return;

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !modalRef.current) return;

      const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
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

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (closeOnBackdropClick && e.target === e.currentTarget) {
      onClose();
    }
  };

  const positionClasses = {
    center: 'items-center justify-center',
    top: 'items-start justify-center pt-20',
    right: 'items-stretch justify-end',
  };

  const modalPositionStyles: CSSProperties =
    position === 'right'
      ? { height: '100vh', borderRadius: '16px 0 0 16px' }
      : {};

  return (
    <div
      className={`fixed inset-0 z-50 flex ${positionClasses[position]}`}
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
      onClick={handleBackdropClick}
      role="presentation"
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
        tabIndex={-1}
        data-testid={testId}
        className={`w-full ${sizeClasses[size]} rounded-lg border overflow-hidden animate-in fade-in zoom-in-95 duration-200 ${className}`}
        style={{
          backgroundColor: 'var(--surface)',
          borderColor: 'var(--border)',
          boxShadow: 'var(--shadow-lg)',
          ...modalPositionStyles,
        }}
      >
        {/* Header */}
        {(title || showCloseButton) && (
          <div
            className="flex items-center justify-between px-6 py-4 border-b"
            style={{ borderColor: 'var(--border)' }}
          >
            <div>
              {title && (
                <h2
                  id="modal-title"
                  className="text-xl italic"
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
                  className="text-sm mt-0.5"
                  style={{ color: 'var(--foreground-muted)' }}
                >
                  {subtitle}
                </p>
              )}
            </div>
            {showCloseButton && (
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
                style={{ color: 'var(--foreground-muted)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--surface-light)';
                  e.currentTarget.style.color = 'var(--foreground)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = 'var(--foreground-muted)';
                }}
                aria-label="Close modal"
              >
                <X size={16} />
              </button>
            )}
          </div>
        )}

        {/* Content */}
        <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 200px)' }}>
          {children}
        </div>
      </div>
    </div>
  );
}

/**
 * ModalContent - Padded content area
 */
export function ModalContent({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`p-6 ${className}`}>{children}</div>;
}

/**
 * ModalFooter - Footer with action buttons
 */
export function ModalFooter({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex items-center justify-end gap-3 px-6 py-4 border-t ${className}`}
      style={{ borderColor: 'var(--border)' }}
    >
      {children}
    </div>
  );
}
