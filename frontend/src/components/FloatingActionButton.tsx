'use client';

import { useSidePanel } from '@/components/ui';
import { useChatStore } from '@/stores/useChatStore';
import UnifiedChatContent from './UnifiedChatContent';

/**
 * Floating Action Button - Unified Assistant
 *
 * Single branded button (circle with pill/band) that opens the unified chat interface.
 * Features a subtle periodic pulse animation to draw attention.
 *
 * Opens in bubble mode (minimal: one-liner status + input) by default.
 */
export default function FloatingActionButton() {
  const { openBubble, isOpen, activeContent, close } = useSidePanel();
  const { bubbleStatusText } = useChatStore();

  const handleClick = () => {
    if (isOpen && activeContent?.id === 'assistant') {
      // Toggle off if already open
      close();
    } else {
      openBubble({
        id: 'assistant',
        title: bubbleStatusText,
        content: <UnifiedChatContent />,
        // Custom flag for minimal bubble mode
        minimal: true,
      } as any);
    }
  };

  const isAssistantOpen = isOpen && activeContent?.id === 'assistant';

  // Hide the button when the chat panel is open
  if (isAssistantOpen) {
    return null;
  }

  return (
    <div
      className="fixed z-50"
      style={{
        bottom: '24px',
        right: '24px',
      }}
    >
      <button
        onClick={handleClick}
        className="flex items-center justify-center rounded-full cursor-pointer transition-transform duration-200 fab-pulse"
        style={{
          width: '48px',
          height: '48px',
          backgroundColor: 'var(--charcoal)',
          boxShadow: '0 2px 12px rgba(0, 0, 0, 0.15)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.08)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
        }}
        title="Assistant"
        aria-label="Open assistant"
      >
        {/* Brand logo: horizontal pill inside circle */}
        <div
          className="rounded-full"
          style={{
            width: '20px',
            height: '6px',
            backgroundColor: 'var(--primary)',
          }}
        />
      </button>

      {/* Pulse animation styles */}
      <style jsx>{`
        @keyframes fab-pulse {
          0%, 100% {
            box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
          }
          50% {
            box-shadow: 0 2px 20px rgba(76, 175, 80, 0.35);
          }
        }

        .fab-pulse {
          animation: fab-pulse 3s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
