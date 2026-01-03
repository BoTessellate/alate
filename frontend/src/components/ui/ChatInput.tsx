'use client';

import { useState, useRef, useEffect, type KeyboardEvent } from 'react';
import { Send, Loader2 } from 'lucide-react';

export interface ChatInputProps {
  /** Callback when message is submitted */
  onSubmit: (message: string) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Whether input is disabled */
  disabled?: boolean;
  /** Whether a message is being sent */
  isLoading?: boolean;
  /** Auto-focus on mount */
  autoFocus?: boolean;
  /** Test ID for testing */
  'data-testid'?: string;
}

/**
 * ChatInput - Input field for sending chat messages
 *
 * Features:
 * - Auto-expanding textarea
 * - Submit on Enter (Shift+Enter for new line)
 * - Loading state
 * - Disabled state
 *
 * Usage:
 * ```tsx
 * <ChatInput
 *   onSubmit={(message) => sendMessage(message)}
 *   placeholder="Ask about products..."
 *   isLoading={isSending}
 * />
 * ```
 */
export function ChatInput({
  onSubmit,
  placeholder = 'Type a message...',
  disabled = false,
  isLoading = false,
  autoFocus = false,
  'data-testid': testId,
}: ChatInputProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-focus on mount
  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [autoFocus]);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Reset height to auto to get correct scrollHeight
    textarea.style.height = 'auto';
    // Set height to scrollHeight (capped at max)
    const maxHeight = 120; // ~4 lines
    textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
  }, [value]);

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled || isLoading) return;

    onSubmit(trimmed);
    setValue('');

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Submit on Enter (without Shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const canSubmit = value.trim().length > 0 && !disabled && !isLoading;

  return (
    <div
      className="flex items-end gap-2 p-3 border-t"
      style={{ borderColor: 'var(--border)' }}
      data-testid={testId}
    >
      {/* Text input */}
      <div
        className="flex-1 rounded-xl px-4 py-2"
        style={{ backgroundColor: 'var(--surface-light)' }}
      >
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled || isLoading}
          rows={1}
          className="w-full bg-transparent resize-none text-sm outline-none focus:outline-none"
          style={{
            color: 'var(--foreground)',
            minHeight: '24px',
            maxHeight: '120px',
          }}
          data-testid={testId ? `${testId}-textarea` : undefined}
        />
      </div>

      {/* Send button */}
      <button
        onClick={handleSubmit}
        disabled={!canSubmit}
        className="w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200"
        style={{
          backgroundColor: canSubmit ? 'var(--primary-dark)' : 'var(--surface-light)',
          color: canSubmit ? 'white' : 'var(--foreground-muted)',
          cursor: canSubmit ? 'pointer' : 'not-allowed',
          opacity: disabled ? 0.5 : 1,
        }}
        onMouseEnter={(e) => {
          if (canSubmit) {
            e.currentTarget.style.backgroundColor = 'var(--primary)';
          }
        }}
        onMouseLeave={(e) => {
          if (canSubmit) {
            e.currentTarget.style.backgroundColor = 'var(--primary-dark)';
          }
        }}
        aria-label="Send message"
        data-testid={testId ? `${testId}-send` : undefined}
      >
        {isLoading ? (
          <Loader2 size={18} className="animate-spin" />
        ) : (
          <Send size={18} />
        )}
      </button>
    </div>
  );
}

export default ChatInput;
