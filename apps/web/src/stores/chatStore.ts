import { create } from 'zustand';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Represents a single chat message in a conversation.
 */
interface ChatMessage {
  id: string;
  role: string;
  content: string;
  contentType: string;
  createdAt: string;
}

/**
 * Partial updates that can be applied to a conversation's metadata.
 * Used to update status, emotion analysis, and summaries.
 */
interface ConversationUpdate {
  status?: string;
  emotion?: string;
  emotionScore?: number;
  summary?: string;
}

/**
 * Chat store state structure.
 * Manages in-memory message history, typing indicators, and conversation metadata.
 */
interface ChatState {
  /** Messages grouped by conversation ID */
  messagesByConversation: Record<string, ChatMessage[]>;
  /** Typing indicators per conversation ID */
  typingByConversation: Record<string, boolean>;
  /** Metadata updates per conversation ID */
  conversationUpdates: Record<string, ConversationUpdate>;
  /** Add a message to a conversation (with automatic eviction of old conversations) */
  addMessage: (conversationId: string, message: ChatMessage) => void;
  /** Set typing indicator for a conversation */
  setTyping: (conversationId: string, isTyping: boolean) => void;
  /** Update conversation metadata (status, emotion, etc.) */
  updateConversation: (conversationId: string, update: ConversationUpdate) => void;
  /** Clear all data for a specific conversation */
  clearConversation: (conversationId: string) => void;
  /** Clear all conversations */
  clearAll: () => void;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

/**
 * Chat store for managing real-time conversation state.
 *
 * Features:
 * - In-memory message storage per conversation
 * - Typing indicators
 * - Conversation metadata (status, emotion, summary)
 * - Automatic eviction: maintains max 30 conversations in memory (LRU-style)
 *
 * Usage:
 * ```tsx
 * const { addMessage, setTyping, messagesByConversation } = useChatStore();
 *
 * // Add a message
 * addMessage('conv-123', {
 *   id: 'msg-1',
 *   role: 'user',
 *   content: 'Hello',
 *   contentType: 'text',
 *   createdAt: new Date().toISOString(),
 * });
 *
 * // Get messages for a conversation
 * const messages = messagesByConversation['conv-123'] || [];
 * ```
 *
 * Note: This store maintains a maximum of 30 conversations. When the limit
 * is exceeded, the oldest conversations (by insertion order) are evicted.
 */
export const useChatStore = create<ChatState>((set) => ({
  messagesByConversation: {},
  typingByConversation: {},
  conversationUpdates: {},

  addMessage: (conversationId, message) =>
    set((state) => {
      const updated = {
        ...state.messagesByConversation,
        [conversationId]: [
          ...(state.messagesByConversation[conversationId] || []),
          message,
        ],
      };

      // Evict oldest conversations if over limit (MAX_CONVERSATIONS = 30)
      // This prevents unbounded memory growth in long-running sessions
      const MAX_CONVERSATIONS = 30;
      const keys = Object.keys(updated);
      if (keys.length > MAX_CONVERSATIONS) {
        const toRemove = keys.slice(0, keys.length - MAX_CONVERSATIONS);
        toRemove.forEach(k => delete updated[k]);
      }

      return { messagesByConversation: updated };
    }),

  setTyping: (conversationId, isTyping) =>
    set((state) => ({
      typingByConversation: {
        ...state.typingByConversation,
        [conversationId]: isTyping,
      },
    })),

  updateConversation: (conversationId, update) =>
    set((state) => ({
      conversationUpdates: {
        ...state.conversationUpdates,
        [conversationId]: {
          ...state.conversationUpdates[conversationId],
          ...update,
        },
      },
    })),

  clearConversation: (conversationId) =>
    set((state) => {
      const { [conversationId]: _, ...restMessages } = state.messagesByConversation;
      const { [conversationId]: __, ...restTyping } = state.typingByConversation;
      const { [conversationId]: ___, ...restUpdates } = state.conversationUpdates;
      return {
        messagesByConversation: restMessages,
        typingByConversation: restTyping,
        conversationUpdates: restUpdates,
      };
    }),

  clearAll: () =>
    set({ messagesByConversation: {}, typingByConversation: {}, conversationUpdates: {} }),
}));
