import { create } from 'zustand';

interface ChatMessage {
  id: string;
  role: string;
  content: string;
  contentType: string;
  createdAt: string;
}

interface ConversationUpdate {
  status?: string;
  emotion?: string;
  emotionScore?: number;
  summary?: string;
}

interface ChatState {
  messagesByConversation: Record<string, ChatMessage[]>;
  typingByConversation: Record<string, boolean>;
  conversationUpdates: Record<string, ConversationUpdate>;
  addMessage: (conversationId: string, message: ChatMessage) => void;
  setTyping: (conversationId: string, isTyping: boolean) => void;
  updateConversation: (conversationId: string, update: ConversationUpdate) => void;
  clearConversation: (conversationId: string) => void;
}

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
      // Evict oldest conversations if over limit
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
}));
