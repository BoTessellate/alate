'use client';

import { memo, type ReactNode } from 'react';
import { User, Sparkles, Loader2 } from 'lucide-react';

export type MessageRole = 'user' | 'assistant' | 'system';

export interface ChatMessageProps {
  /** Message role/sender */
  role: MessageRole;
  /** Message content */
  content: ReactNode;
  /** Optional timestamp */
  timestamp?: Date;
  /** Whether the message is being streamed/loading */
  isStreaming?: boolean;
  /** Test ID for testing */
  'data-testid'?: string;
}

/**
 * ChatMessage - A single message in a chat conversation
 *
 * Features:
 * - Different styling for user vs assistant messages
 * - Streaming indicator for loading states
 * - Avatar icons based on role
 * - Timestamp display (optional)
 *
 * Usage:
 * ```tsx
 * <ChatMessage
 *   role="user"
 *   content="Find me a blue sofa under $500"
 * />
 * <ChatMessage
 *   role="assistant"
 *   content="I found 3 sofas matching your criteria..."
 *   isStreaming
 * />
 * ```
 */
function ChatMessageComponent({
  role,
  content,
  timestamp,
  isStreaming = false,
  'data-testid': testId,
}: ChatMessageProps) {
  const isUser = role === 'user';
  const isAssistant = role === 'assistant';
  const isSystem = role === 'system';

  // System messages are centered and styled differently
  if (isSystem) {
    return (
      <div
        className="flex justify-center py-2"
        data-testid={testId}
      >
        <div
          className="px-3 py-1.5 rounded-full text-xs"
          style={{
            backgroundColor: 'var(--surface-light)',
            color: 'var(--foreground-muted)',
          }}
        >
          {content}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
      data-testid={testId}
    >
      {/* Avatar */}
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
        style={{
          backgroundColor: isUser ? 'var(--primary-alpha)' : 'var(--surface-light)',
          color: isUser ? 'var(--primary-dark)' : 'var(--foreground-muted)',
        }}
      >
        {isUser ? <User size={16} /> : <Sparkles size={16} />}
      </div>

      {/* Message bubble */}
      <div
        className={`flex flex-col max-w-[80%] ${isUser ? 'items-end' : 'items-start'}`}
      >
        <div
          className="px-4 py-2.5 rounded-2xl"
          style={{
            backgroundColor: isUser ? 'var(--primary-dark)' : 'var(--surface-light)',
            color: isUser ? 'white' : 'var(--foreground)',
            borderRadius: isUser
              ? '16px 16px 4px 16px'
              : '16px 16px 16px 4px',
          }}
        >
          {/* Content */}
          <div className="text-sm whitespace-pre-wrap">
            {content}
            {isStreaming && isAssistant && (
              <span className="inline-flex items-center ml-1">
                <Loader2 size={12} className="animate-spin" />
              </span>
            )}
          </div>
        </div>

        {/* Timestamp */}
        {timestamp && (
          <span
            className="text-xs mt-1 px-1"
            style={{ color: 'var(--foreground-muted)' }}
          >
            {formatTime(timestamp)}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Format time for display
 */
function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

// Memoize to prevent unnecessary re-renders
export const ChatMessage = memo(ChatMessageComponent);
export default ChatMessage;
