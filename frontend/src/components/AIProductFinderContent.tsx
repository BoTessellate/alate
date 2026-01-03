'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { ChatMessage, ChatInput, type Message } from '@/components/ui';

// Generate unique IDs for messages
const generateId = () => `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

// Suggested prompts for the AI assistant
const suggestedPrompts = [
  'Show me sofas under $1000',
  'Find mid-century modern chairs',
  'Blue accent pieces for living room',
  'Scandinavian style furniture',
];

/**
 * Self-contained AI Product Finder chat content
 * Manages its own state so it can be used in SidePanel
 */
export default function AIProductFinderContent() {
  const router = useRouter();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Handle sending a message to the AI
  const handleSendMessage = useCallback(async (content: string) => {
    // Add user message
    const userMessage: Message = {
      id: generateId(),
      role: 'user',
      content,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      // Simulate AI thinking time
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Perform the search
      router.push(`/discover?q=${encodeURIComponent(content)}`);

      // Add AI response
      const aiMessage: Message = {
        id: generateId(),
        role: 'assistant',
        content: `I'm searching for "${content}". Let me show you what I found!`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiMessage]);
    } catch (err) {
      // Handle error
      const errorMessage: Message = {
        id: generateId(),
        role: 'assistant',
        content: 'Sorry, I encountered an issue. Please try again.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  const hasMessages = messages.length > 0;

  return (
    <div className="flex flex-col h-full">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {!hasMessages ? (
          // Welcome state
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center mb-4"
              style={{ backgroundColor: 'var(--primary-alpha)' }}
            >
              <span className="text-2xl" style={{ color: 'var(--primary-dark)' }}>
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
              Tell me what you're looking for and I'll help you find the perfect products.
            </p>

            {/* Suggested prompts */}
            <div className="flex flex-wrap gap-2 justify-center">
              {suggestedPrompts.map((prompt, index) => (
                <button
                  key={index}
                  onClick={() => handleSendMessage(prompt)}
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
        onSubmit={handleSendMessage}
        placeholder="Describe what you're looking for..."
        isLoading={isLoading}
      />
    </div>
  );
}
