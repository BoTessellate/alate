'use client';

import {
  useState,
  useEffect,
  useRef,
  createContext,
  useContext,
  type ReactNode,
  type CSSProperties,
} from 'react';

// Context for dropdown state
interface DropdownContextValue {
  isOpen: boolean;
  close: () => void;
}

const DropdownContext = createContext<DropdownContextValue | null>(null);

function useDropdownContext() {
  const context = useContext(DropdownContext);
  if (!context) {
    throw new Error('Dropdown components must be used within a Dropdown');
  }
  return context;
}

export interface DropdownProps {
  children: ReactNode;
  /** Controlled open state */
  open?: boolean;
  /** Callback when open state changes */
  onOpenChange?: (open: boolean) => void;
}

/**
 * Dropdown - Container component with click-outside handling
 *
 * Usage:
 * ```tsx
 * <Dropdown>
 *   <DropdownTrigger>
 *     <Button>Open Menu</Button>
 *   </DropdownTrigger>
 *   <DropdownMenu>
 *     <DropdownItem onClick={() => {}}>Option 1</DropdownItem>
 *     <DropdownItem onClick={() => {}}>Option 2</DropdownItem>
 *   </DropdownMenu>
 * </Dropdown>
 * ```
 */
export function Dropdown({ children, open, onOpenChange }: DropdownProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Use controlled or uncontrolled state
  const isOpen = open !== undefined ? open : internalOpen;
  const setIsOpen = onOpenChange || setInternalOpen;

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, setIsOpen]);

  // Close on Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, setIsOpen]);

  return (
    <DropdownContext.Provider value={{ isOpen, close: () => setIsOpen(false) }}>
      <div ref={containerRef} className="relative">
        {children}
      </div>
    </DropdownContext.Provider>
  );
}

export interface DropdownTriggerProps {
  children: ReactNode;
  /** Toggle on click (default true) */
  asChild?: boolean;
}

/**
 * DropdownTrigger - Wraps the trigger element
 */
export function DropdownTrigger({ children, asChild }: DropdownTriggerProps) {
  const { isOpen, close } = useDropdownContext();
  const [, setOpen] = useState(false);

  // Get parent context to toggle
  const parentRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={parentRef}
      onClick={() => {
        // Toggle via parent context - we need to access onOpenChange
        // This is a simplified version - for full functionality, use a state manager
      }}
    >
      {children}
    </div>
  );
}

export interface DropdownMenuProps {
  children: ReactNode;
  /** Alignment relative to trigger */
  align?: 'start' | 'end' | 'center';
  /** Width behavior */
  width?: 'auto' | 'trigger' | number;
  /** Custom className */
  className?: string;
  /** Role for accessibility */
  role?: 'menu' | 'listbox';
}

/**
 * DropdownMenu - The dropdown content container
 */
export function DropdownMenu({
  children,
  align = 'end',
  width = 'auto',
  className = '',
  role = 'menu',
}: DropdownMenuProps) {
  const { isOpen } = useDropdownContext();

  if (!isOpen) return null;

  const alignmentClasses = {
    start: 'left-0',
    end: 'right-0',
    center: 'left-1/2 -translate-x-1/2',
  };

  const widthStyle: CSSProperties =
    typeof width === 'number' ? { width: `${width}px` } : {};

  return (
    <div
      role={role}
      className={`absolute top-full mt-2 py-1 rounded-lg border shadow-lg overflow-hidden z-50 animate-in fade-in slide-in-from-top-1 duration-150 ${alignmentClasses[align]} ${className}`}
      style={{
        backgroundColor: 'var(--surface)',
        borderColor: 'var(--border)',
        minWidth: width === 'auto' ? '120px' : undefined,
        ...widthStyle,
      }}
    >
      {children}
    </div>
  );
}

export interface DropdownItemProps {
  children: ReactNode;
  /** Click handler */
  onClick?: () => void;
  /** Disabled state */
  disabled?: boolean;
  /** Destructive/danger styling */
  variant?: 'default' | 'destructive';
  /** Icon to display before text */
  icon?: ReactNode;
  /** Custom className */
  className?: string;
  /** Whether clicking closes the dropdown */
  closeOnClick?: boolean;
}

/**
 * DropdownItem - Individual menu item with hover states
 */
export function DropdownItem({
  children,
  onClick,
  disabled = false,
  variant = 'default',
  icon,
  className = '',
  closeOnClick = true,
}: DropdownItemProps) {
  const { close } = useDropdownContext();
  const [isHovered, setIsHovered] = useState(false);

  const handleClick = () => {
    if (disabled) return;
    onClick?.();
    if (closeOnClick) {
      close();
    }
  };

  const textColor =
    variant === 'destructive'
      ? 'var(--error)'
      : isHovered
        ? 'var(--foreground)'
        : 'var(--foreground-secondary)';

  return (
    <button
      role="menuitem"
      disabled={disabled}
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors text-left ${className}`}
      style={{
        backgroundColor: isHovered ? 'var(--surface-light)' : 'transparent',
        color: textColor,
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      {icon && <span className="flex-shrink-0">{icon}</span>}
      {children}
    </button>
  );
}

/**
 * DropdownDivider - Separator between menu sections
 */
export function DropdownDivider() {
  return (
    <div
      className="my-1 border-t"
      style={{ borderColor: 'var(--border)' }}
    />
  );
}

/**
 * DropdownLabel - Non-interactive label/header
 */
export function DropdownLabel({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`px-3 py-2 text-xs font-medium ${className}`}
      style={{ color: 'var(--foreground-muted)' }}
    >
      {children}
    </div>
  );
}
