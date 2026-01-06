import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Product } from '@/types';

// =============================================================================
// TYPES
// =============================================================================

export type MessageType =
  | 'user-text'
  | 'user-image'
  | 'user-url'
  | 'assistant-text'
  | 'assistant-products'
  | 'assistant-status';

export type ProcessingStage =
  | 'idle'
  | 'uploading'
  | 'removing-bg'
  | 'enriching'
  | 'scraping'
  | 'searching'
  | 'complete'
  | 'error';

export type StatusType = 'success' | 'error' | 'info' | 'processing';

export interface ChatProduct extends Product {
  isAddedToCloset?: boolean;
  isWishlisted?: boolean;
}

export interface NavigationHint {
  text: string;
  route: string;
  collectionName: string;
}

export interface ChatMessage {
  id: string;
  type: MessageType;
  content: string;
  timestamp: string;
  // For image uploads
  imagePreviewUrl?: string;
  // For product results
  products?: ChatProduct[];
  // For status messages
  statusType?: StatusType;
  // Search query for "see more" link
  searchQuery?: string;
  // Navigation hint for closet/collection link (Issue 4)
  navigationHint?: NavigationHint;
  // For awaiting user input (Issue 2 - Natural Language)
  awaitingInput?: 'product-details';
  productId?: string;
}

export interface ProcessingState {
  isProcessing: boolean;
  currentMessageId: string | null;
  stage: ProcessingStage;
  progress: number;
  statusText: string;
  error: string | null;
}

interface ChatState {
  // Message history
  messages: ChatMessage[];

  // Processing state
  processing: ProcessingState;

  // Pending attachment
  pendingImage: File | null;
  pendingImagePreview: string | null;

  // Status text for bubble header
  bubbleStatusText: string;

  // Actions
  addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => string;
  updateMessage: (id: string, updates: Partial<ChatMessage>) => void;
  removeMessage: (id: string) => void;
  clearHistory: () => void;

  // Processing actions
  startProcessing: (stage: ProcessingStage, statusText?: string) => void;
  updateProgress: (progress: number) => void;
  updateStage: (stage: ProcessingStage, statusText?: string) => void;
  finishProcessing: (statusText?: string) => void;
  setProcessingError: (error: string) => void;

  // Bubble status
  setBubbleStatus: (text: string) => void;
  resetBubbleStatus: () => void;

  // Attachment actions
  setPendingImage: (file: File | null, previewUrl?: string | null) => void;
  clearPendingImage: () => void;

  // Product actions (mutually exclusive - selecting one clears the other)
  toggleProductWishlist: (messageId: string, productId: string) => void;
  toggleProductCloset: (messageId: string, productId: string) => void;
}

// =============================================================================
// HELPERS
// =============================================================================

const generateId = () => `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

const DEFAULT_BUBBLE_STATUS = 'How can I help?';

const STAGE_STATUS_MAP: Record<ProcessingStage, string> = {
  idle: DEFAULT_BUBBLE_STATUS,
  uploading: 'Uploading image...',
  'removing-bg': 'Removing background...',
  enriching: 'Analyzing product...',
  scraping: 'Fetching product info...',
  searching: 'Searching products...',
  complete: 'Done!',
  error: 'Something went wrong',
};

// =============================================================================
// STORE
// =============================================================================

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      messages: [],
      processing: {
        isProcessing: false,
        currentMessageId: null,
        stage: 'idle',
        progress: 0,
        statusText: DEFAULT_BUBBLE_STATUS,
        error: null,
      },
      pendingImage: null,
      pendingImagePreview: null,
      bubbleStatusText: DEFAULT_BUBBLE_STATUS,

      // Message actions
      addMessage: (message) => {
        const id = generateId();
        const newMessage: ChatMessage = {
          ...message,
          id,
          timestamp: new Date().toISOString(),
        };

        set((state) => ({
          messages: [...state.messages.slice(-49), newMessage], // Keep last 50
        }));

        return id;
      },

      updateMessage: (id, updates) => {
        set((state) => ({
          messages: state.messages.map((msg) =>
            msg.id === id ? { ...msg, ...updates } : msg
          ),
        }));
      },

      removeMessage: (id) => {
        set((state) => ({
          messages: state.messages.filter((msg) => msg.id !== id),
        }));
      },

      clearHistory: () => {
        set({ messages: [] });
      },

      // Processing actions
      startProcessing: (stage, statusText) => {
        const text = statusText || STAGE_STATUS_MAP[stage];
        set({
          processing: {
            isProcessing: true,
            currentMessageId: null,
            stage,
            progress: 0,
            statusText: text,
            error: null,
          },
          bubbleStatusText: text,
        });
      },

      updateProgress: (progress) => {
        set((state) => ({
          processing: {
            ...state.processing,
            progress: Math.min(100, Math.max(0, progress)),
          },
        }));
      },

      updateStage: (stage, statusText) => {
        const text = statusText || STAGE_STATUS_MAP[stage];
        set((state) => ({
          processing: {
            ...state.processing,
            stage,
            statusText: text,
          },
          bubbleStatusText: text,
        }));
      },

      finishProcessing: (statusText) => {
        const text = statusText || 'Done!';
        set({
          processing: {
            isProcessing: false,
            currentMessageId: null,
            stage: 'complete',
            progress: 100,
            statusText: text,
            error: null,
          },
          bubbleStatusText: text,
        });

        // Reset status after 3 seconds
        setTimeout(() => {
          const current = get().bubbleStatusText;
          if (current === text) {
            set({ bubbleStatusText: DEFAULT_BUBBLE_STATUS });
          }
        }, 3000);
      },

      setProcessingError: (error) => {
        set({
          processing: {
            isProcessing: false,
            currentMessageId: null,
            stage: 'error',
            progress: 0,
            statusText: error,
            error,
          },
          bubbleStatusText: error,
        });

        // Reset status after 5 seconds
        setTimeout(() => {
          const current = get().bubbleStatusText;
          if (current === error) {
            set({ bubbleStatusText: DEFAULT_BUBBLE_STATUS });
          }
        }, 5000);
      },

      // Bubble status
      setBubbleStatus: (text) => {
        set({ bubbleStatusText: text });
      },

      resetBubbleStatus: () => {
        set({ bubbleStatusText: DEFAULT_BUBBLE_STATUS });
      },

      // Attachment actions
      setPendingImage: (file, previewUrl) => {
        // Revoke old preview URL if exists
        const oldPreview = get().pendingImagePreview;
        if (oldPreview && oldPreview.startsWith('blob:')) {
          URL.revokeObjectURL(oldPreview);
        }

        set({
          pendingImage: file,
          pendingImagePreview: previewUrl || null,
        });
      },

      clearPendingImage: () => {
        const oldPreview = get().pendingImagePreview;
        if (oldPreview && oldPreview.startsWith('blob:')) {
          URL.revokeObjectURL(oldPreview);
        }

        set({
          pendingImage: null,
          pendingImagePreview: null,
        });
      },

      // Product actions (mutually exclusive - selecting one clears the other)
      toggleProductWishlist: (messageId, productId) => {
        set((state) => ({
          messages: state.messages.map((msg) => {
            if (msg.id !== messageId || !msg.products) return msg;
            return {
              ...msg,
              products: msg.products.map((p) =>
                p.id === productId
                  ? { ...p, isWishlisted: !p.isWishlisted, isAddedToCloset: false }
                  : p
              ),
            };
          }),
        }));
      },

      toggleProductCloset: (messageId, productId) => {
        set((state) => ({
          messages: state.messages.map((msg) => {
            if (msg.id !== messageId || !msg.products) return msg;
            return {
              ...msg,
              products: msg.products.map((p) =>
                p.id === productId
                  ? { ...p, isAddedToCloset: !p.isAddedToCloset, isWishlisted: false }
                  : p
              ),
            };
          }),
        }));
      },
    }),
    {
      name: 'stel-chat-history',
      version: 1,
      partialize: (state) => ({
        // Only persist messages, not processing state or pending attachments
        messages: state.messages,
      }),
      onRehydrateStorage: () => (state) => {
        if (state && state.messages.length > 0) {
          // Clear messages older than 24 hours using proper setter
          const cutoff = Date.now() - 24 * 60 * 60 * 1000;
          const filteredMessages = state.messages.filter(
            (m) => new Date(m.timestamp).getTime() > cutoff
          );
          // Only update if we actually filtered something
          if (filteredMessages.length !== state.messages.length) {
            useChatStore.setState({ messages: filteredMessages });
          }
        }
      },
    }
  )
);
