'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { ExpandablePanel, type ExpandablePanelProps } from './ExpandablePanel';
import { ChatMessage, type MessageRole } from './ChatMessage';
import { ChatInput } from './ChatInput';

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
}

export interface ChatPanelProps extends Omit<ExpandablePanelProps, 'children'> {
  /** Messages to display */
  messages: Message[];
  /** Callback when user sends a message */
  onSendMessage: (message: string) => void;
  /** Whether a response is being generated */
  isLoading?: boolean;
  /** Placeholder text for input */
  inputPlaceholder?: string;
  /** Welcome message shown when no messages */
  welcomeMessage?: string;
  /** Suggested prompts shown when no messages */
  suggestedPrompts?: string[];
  /** Callback when a suggested prompt is clicked */
  onSuggestedPromptClick?: (prompt: string) => void;
}

/**
 * ChatPanel - A complete chat interface in an expandable panel
 *
 * Features:
 * - Message history display
 * - Auto-scroll to latest message
 * - Welcome message and suggested prompts
 * - Loading state for AI responses
 * - Expandable between compact and full modes
 *
 * Usage:
 * ```tsx
 * <ChatPanel
 *   isOpen={showChat}
 *   onClose={() => setShowChat(false)}
 *   title="AI Assistant"
 *   messages={messages}
 *   onSendMessage={handleSend}
 *   isLoading={isGenerating}
 *   suggestedPrompts={['Find blue sofas', 'Show me mid-century modern']}
 * />
 * ```
 */
export function ChatPanel({
  messages,
  onSendMessage,
  isLoading = false,
  inputPlaceholder = 'Ask about products...',
  welcomeMessage = 'How can I help you find the perfect products?',
  suggestedPrompts = [],
  onSuggestedPromptClick,
  ...panelProps
}: ChatPanelProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handlePromptClick = useCallback((prompt: string) => {
    if (onSuggestedPromptClick) {
      onSuggestedPromptClick(prompt);
    } else {
      onSendMessage(prompt);
    }
  }, [onSendMessage, onSuggestedPromptClick]);

  const hasMessages = messages.length > 0;

  return (
    <ExpandablePanel {...panelProps}>
      <div className="flex flex-col h-full">
        {/* Messages area */}
        <div
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto p-4 space-y-4"
        >
          {!hasMessages ? (
            // Welcome state
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center mb-4"
                style={{ backgroundColor: 'var(--primary-alpha)' }}
              >
                <span
                  className="text-2xl"
                  style={{ color: 'var(--primary-dark)' }}
                >
                  ✨
                </span>
              </div>
              <p
                className="text-lg italic mb-6"
                style={{
                  fontFamily: 'var(--font-cormorant)',
                  color: 'var(--foreground)',
                }}
              >
                {welcomeMessage}
              </p>

              {/* Suggested prompts */}
              {suggestedPrompts.length > 0 && (
                <div className="flex flex-wrap gap-2 justify-center">
                  {suggestedPrompts.map((prompt, index) => (
                    <button
                      key={index}
                      onClick={() => handlePromptClick(prompt)}
                      className="px-3 py-1.5 rounded-full text-sm transition-colors"
                      style={{
                        backgroundColor: 'var(--surface-light)',
                        color: 'var(--foreground-secondary)',
                        border: '1px solid var(--border)',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--surface-elevated)';
                        e.currentTarget.style.borderColor = 'var(--primary)';
                        e.currentTarget.style.color = 'var(--primary-dark)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--surface-light)';
                        e.currentTarget.style.borderColor = 'var(--border)';
                        e.currentTarget.style.color = 'var(--foreground-secondary)';
                      }}
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            // Message list
            <>
              {messages.map((message) => (
                <ChatMessage
                  key={message.id}
                  role={message.role}
                  content={message.content}
                  timestamp={message.timestamp}
                  data-testid={`message-${message.id}`}
                />
              ))}

              {/* Loading indicator */}
              {isLoading && (
                <div className="flex gap-3">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{
                      backgroundColor: 'var(--surface-light)',
                      color: 'var(--foreground-muted)',
                    }}
                  >
                    <Loader2 size={16} className="animate-spin" />
                  </div>
                  <div
                    className="px-4 py-2.5 rounded-2xl"
                    style={{
                      backgroundColor: 'var(--surface-light)',
                      borderRadius: '16px 16px 16px 4px',
                    }}
                  >
                    <div className="flex items-center gap-1">
                      <div
                        className="w-2 h-2 rounded-full animate-bounce"
                        style={{
                          backgroundColor: 'var(--foreground-muted)',
                          animationDelay: '0ms',
                        }}
                      />
                      <div
                        className="w-2 h-2 rounded-full animate-bounce"
                        style={{
                          backgroundColor: 'var(--foreground-muted)',
                          animationDelay: '150ms',
                        }}
                      />
                      <div
                        className="w-2 h-2 rounded-full animate-bounce"
                        style={{
                          backgroundColor: 'var(--foreground-muted)',
                          animationDelay: '300ms',
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Scroll anchor */}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input area */}
        <ChatInput
          onSubmit={onSendMessage}
          placeholder={inputPlaceholder}
          isLoading={isLoading}
          autoFocus={panelProps.isOpen}
          data-testid="chat-input"
        />
      </div>
    </ExpandablePanel>
  );
}

export default ChatPanel;
