'use client';

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react';
import { X, ChevronUp, ChevronDown } from 'lucide-react';
import { useChatStore } from '@/stores/useChatStore';

// =============================================================================
// TYPES
// =============================================================================

type PanelMode = 'closed' | 'bubble' | 'panel';

interface SidePanelContent {
  id: string;
  title: string;
  subtitle?: string;
  content: ReactNode;
  /** Enable minimal bubble mode (compact, no scrollable content area) */
  minimal?: boolean;
}

interface SidePanelContextType {
  mode: PanelMode;
  activeContent: SidePanelContent | null;
  openBubble: (content: SidePanelContent) => void;
  openPanel: (content: SidePanelContent) => void;
  expandToPanel: () => void;
  collapseToBubble: () => void;
  close: () => void;
  isOpen: boolean;
  isPanelMode: boolean;
}

// =============================================================================
// CONTEXT
// =============================================================================

const SidePanelContext = createContext<SidePanelContextType | null>(null);

export function useSidePanel() {
  const context = useContext(SidePanelContext);
  if (!context) {
    throw new Error('useSidePanel must be used within a SidePanelProvider');
  }
  return context;
}

// =============================================================================
// PROVIDER
// =============================================================================

interface SidePanelProviderProps {
  children: ReactNode;
}

export function SidePanelProvider({ children }: SidePanelProviderProps) {
  const [mode, setMode] = useState<PanelMode>('closed');
  const [activeContent, setActiveContent] = useState<SidePanelContent | null>(null);

  const openBubble = useCallback((content: SidePanelContent) => {
    setActiveContent(content);
    setMode('bubble');
  }, []);

  const openPanel = useCallback((content: SidePanelContent) => {
    setActiveContent(content);
    setMode('panel');
  }, []);

  const expandToPanel = useCallback(() => {
    setMode('panel');
  }, []);

  const collapseToBubble = useCallback(() => {
    setMode('bubble');
  }, []);

  const close = useCallback(() => {
    setMode('closed');
    // Keep content briefly for exit animation
    setTimeout(() => setActiveContent(null), 300);
  }, []);

  const isOpen = mode !== 'closed';
  const isPanelMode = mode === 'panel';

  return (
    <SidePanelContext.Provider
      value={{
        mode,
        activeContent,
        openBubble,
        openPanel,
        expandToPanel,
        collapseToBubble,
        close,
        isOpen,
        isPanelMode,
      }}
    >
      {children}
    </SidePanelContext.Provider>
  );
}

// =============================================================================
// LAYOUT CONSTANTS
// =============================================================================

/**
 * CRITICAL: Side panel positioning constants
 *
 * The side panel MUST appear BELOW the TopBar's curved bottom edge.
 * The TopBar has a curved bottom that extends beyond --topbar-height.
 *
 * Layout hierarchy (top to bottom):
 * 1. TopBar (fixed, z-50) - height: var(--topbar-height) + curved bottom
 * 2. SidePanel (fixed, z-30) - starts at var(--topbar-total-height)
 * 3. Main content - has padding-top for topbar
 *
 * CSS Variables used (defined in globals.css):
 * - --topbar-height: 56px (the flat portion)
 * - --topbar-curve-offset: 20px (space for curved bottom)
 * - --topbar-total-height: calc(--topbar-height + --topbar-curve-offset)
 *
 * DO NOT use --topbar-height directly for panel positioning!
 * ALWAYS use --topbar-total-height to account for the curve.
 */
const SIDE_PANEL_WIDTH = '480px';

// =============================================================================
// LAYOUT COMPONENT
// =============================================================================

interface SidePanelLayoutProps {
  children: ReactNode;
}

/**
 * SidePanelLayout - Wraps main content and manages the side panel
 *
 * When panel is in "panel" mode, main content shrinks to make room.
 * When panel is in "bubble" mode, it overlays as a floating card.
 *
 * IMPORTANT: The expanded panel uses --topbar-total-height for its top position
 * to ensure it renders BELOW the TopBar's curved bottom edge.
 * See LAYOUT CONSTANTS above for details.
 *
 * STATE PERSISTENCE: We render a single content instance and move it between
 * bubble and panel containers to preserve React state across mode transitions.
 */
export function SidePanelLayout({ children }: SidePanelLayoutProps) {
  const { mode, activeContent, expandToPanel, collapseToBubble, close, isPanelMode } = useSidePanel();

  const isBubble = mode === 'bubble';
  const isPanel = mode === 'panel';
  const isMinimal = activeContent?.minimal === true;

  return (
    <>
      {/* Main content area - shrinks when panel is open */}
      <div
        className="flex-1 min-w-0 overflow-hidden transition-all duration-300 ease-out"
        style={{
          marginRight: isPanel ? SIDE_PANEL_WIDTH : 0,
        }}
      >
        {children}
      </div>

      {/* Backdrop for bubble mode only (not for minimal) */}
      {isBubble && activeContent && !isMinimal && (
        <div
          className="fixed inset-0 z-40 bg-black/30 transition-opacity duration-300"
          onClick={close}
        />
      )}

      {/* Minimal Bubble - Compact assistant bubble */}
      {isBubble && activeContent && isMinimal && (
        <MinimalBubble
          content={activeContent}
          onExpand={expandToPanel}
          onClose={close}
        />
      )}

      {/* Standard Bubble Modal - positioned at bottom right */}
      {isBubble && activeContent && !isMinimal && (
        <div
          className="fixed z-50 flex flex-col border overflow-hidden transition-all duration-300 ease-out"
          style={{
            bottom: '90px',
            right: '24px',
            width: '280px',
            maxWidth: 'calc(100vw - 48px)',
            minHeight: '200px',
            maxHeight: '360px',
            borderRadius: '12px',
            backgroundColor: 'var(--surface)',
            borderColor: 'var(--border)',
            boxShadow: 'var(--shadow-lg)',
          }}
        >
          <BubbleHeader
            title={activeContent.title}
            subtitle={activeContent.subtitle}
            onExpand={expandToPanel}
            onClose={close}
          />
          <div className="flex-1 overflow-y-auto">
            {activeContent.content}
          </div>
        </div>
      )}

      {/* Full Side Panel - stretches from topbar to bottom */}
      {isPanel && activeContent && (
        <div
          className="fixed z-30 flex flex-col border-l overflow-hidden transition-transform duration-300 ease-out"
          style={{
            top: 'var(--topbar-total-height, 76px)',
            right: 0,
            bottom: 0,
            width: SIDE_PANEL_WIDTH,
            maxWidth: '100vw',
            backgroundColor: 'var(--surface)',
            borderColor: 'var(--border)',
            boxShadow: 'var(--shadow-lg)',
          }}
        >
          <PanelHeader
            title={isMinimal ? 'Assistant' : activeContent.title}
            subtitle={isMinimal ? 'Upload, search, or ask anything' : activeContent.subtitle}
            onCollapse={collapseToBubble}
            onClose={close}
          />
          <div className="flex-1 overflow-y-auto">
            {activeContent.content}
          </div>
        </div>
      )}

    </>
  );
}

// =============================================================================
// MINIMAL BUBBLE COMPONENT
// =============================================================================

interface MinimalBubbleProps {
  content: SidePanelContent;
  onExpand: () => void;
  onClose: () => void;
}

/**
 * MinimalBubble - Compact bubble for the unified assistant
 *
 * Shows only:
 * - Header with dynamic status text
 * - Input area (content)
 *
 * No scrollable message area - that's only in panel mode.
 *
 * POSITIONING: bottom: 90px leaves 18px clearance above the FloatingActionButton
 * (which is 48px tall positioned at bottom: 24px, so its top is at 72px).
 * Extra 2px accounts for border/sub-pixel rendering to ensure 16px+ visual gap.
 */
function MinimalBubble({ content, onExpand, onClose }: MinimalBubbleProps) {
  const { bubbleStatusText } = useChatStore();

  return (
    <div
      className="fixed z-50 flex flex-col border shadow-xl overflow-hidden transition-all duration-300 ease-out"
      style={{
        bottom: '90px',
        right: '24px',
        width: '300px',
        maxWidth: 'calc(100vw - 48px)',
        borderRadius: '12px',
        backgroundColor: 'var(--surface)',
        borderColor: 'var(--border)',
      }}
    >
      {/* Minimal header with dynamic status */}
      <div
        className="flex items-center justify-between px-3 py-2 border-b flex-shrink-0"
        style={{ borderColor: 'var(--border)' }}
      >
        {/* Expand button */}
        <button
          onClick={onExpand}
          className="w-6 h-6 rounded-full flex items-center justify-center transition-colors flex-shrink-0"
          style={{ color: 'var(--foreground-muted)' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--surface-light)';
            e.currentTarget.style.color = 'var(--foreground)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = 'var(--foreground-muted)';
          }}
          aria-label="Expand to side panel"
          title="Expand to side panel"
        >
          <ChevronUp size={14} />
        </button>

        {/* Dynamic status text */}
        <div className="flex-1 min-w-0 mx-2">
          <p
            className="text-sm truncate text-center"
            style={{
              color: 'var(--foreground-secondary)',
            }}
          >
            {bubbleStatusText}
          </p>
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          className="w-6 h-6 rounded-full flex items-center justify-center transition-colors flex-shrink-0"
          style={{ color: 'var(--foreground-muted)' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--surface-light)';
            e.currentTarget.style.color = 'var(--foreground)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = 'var(--foreground-muted)';
          }}
          aria-label="Close"
        >
          <X size={14} />
        </button>
      </div>

      {/* Content (input only in minimal mode) */}
      <div className="flex-shrink-0">
        {content.content}
      </div>
    </div>
  );
}

// =============================================================================
// HEADER COMPONENTS
// =============================================================================

interface HeaderProps {
  title: string;
  subtitle?: string;
  onClose: () => void;
}

interface BubbleHeaderProps extends HeaderProps {
  onExpand: () => void;
}

interface PanelHeaderProps extends HeaderProps {
  onCollapse: () => void;
}

function BubbleHeader({ title, onExpand, onClose }: BubbleHeaderProps) {
  return (
    <div
      className="flex items-center justify-between px-3 py-2 border-b flex-shrink-0"
      style={{ borderColor: 'var(--border)' }}
    >
      {/* Expand button */}
      <button
        onClick={onExpand}
        className="w-6 h-6 rounded-full flex items-center justify-center transition-colors flex-shrink-0"
        style={{ color: 'var(--foreground-muted)' }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--surface-light)';
          e.currentTarget.style.color = 'var(--foreground)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
          e.currentTarget.style.color = 'var(--foreground-muted)';
        }}
        aria-label="Expand to side panel"
        title="Expand to side panel"
      >
        <ChevronUp size={14} />
      </button>

      {/* Title */}
      <div className="flex-1 min-w-0 mx-2">
        <h2
          className="text-sm italic truncate"
          style={{
            fontFamily: 'var(--font-cormorant)',
            fontWeight: 500,
            color: 'var(--foreground)',
          }}
        >
          {title}
        </h2>
      </div>

      {/* Close button */}
      <button
        onClick={onClose}
        className="w-6 h-6 rounded-full flex items-center justify-center transition-colors flex-shrink-0"
        style={{ color: 'var(--foreground-muted)' }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--surface-light)';
          e.currentTarget.style.color = 'var(--foreground)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
          e.currentTarget.style.color = 'var(--foreground-muted)';
        }}
        aria-label="Close"
      >
        <X size={14} />
      </button>
    </div>
  );
}

function PanelHeader({ title, subtitle, onCollapse, onClose }: PanelHeaderProps) {
  return (
    <div
      className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0"
      style={{ borderColor: 'var(--border)' }}
    >
      {/* Collapse button */}
      <button
        onClick={onCollapse}
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
        aria-label="Collapse to bubble"
        title="Collapse to bubble"
      >
        <ChevronDown size={18} />
      </button>

      {/* Title */}
      <div className="flex-1 min-w-0 mx-4">
        <h2
          className="text-lg italic truncate"
          style={{
            fontFamily: 'var(--font-cormorant)',
            fontWeight: 500,
            color: 'var(--foreground)',
          }}
        >
          {title}
        </h2>
        {subtitle && (
          <p
            className="text-xs mt-0.5 truncate"
            style={{ color: 'var(--foreground-muted)' }}
          >
            {subtitle}
          </p>
        )}
      </div>

      {/* Close button */}
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
        aria-label="Close"
      >
        <X size={16} />
      </button>
    </div>
  );
}

export default SidePanelLayout;
