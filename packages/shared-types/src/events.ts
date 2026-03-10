// ========================
// WebSocket Event Types
// ========================

export interface ServerToClientEvents {
  'conversation:new': (data: ConversationEvent) => void;
  'conversation:updated': (data: ConversationEvent) => void;
  'message:new': (data: MessageEvent) => void;
  'agent:handoff': (data: HandoffEvent) => void;
  'lead:extracted': (data: LeadEvent) => void;
  'typing:start': (data: TypingEvent) => void;
  'typing:stop': (data: TypingEvent) => void;
  notification: (data: NotificationEvent) => void;
}

export interface ClientToServerEvents {
  'join:conversation': (conversationId: string) => void;
  'leave:conversation': (conversationId: string) => void;
  'message:send': (data: SendMessageEvent) => void;
  'typing:start': (conversationId: string) => void;
  'typing:stop': (conversationId: string) => void;
}

export interface ConversationEvent {
  conversationId: string;
  orgId: string;
  status: string;
  channelType: string;
  customerName?: string;
  lastMessage?: string;
  updatedAt: string;
}

export interface MessageEvent {
  messageId: string;
  conversationId: string;
  role: string;
  content: string;
  contentType: string;
  emotion?: string;
  emotionScore?: number;
  createdAt: string;
}

export interface HandoffEvent {
  conversationId: string;
  orgId: string;
  reason: string;
  customerName?: string;
}

export interface LeadEvent {
  leadId: string;
  orgId: string;
  conversationId: string;
  name?: string;
  confidence: number;
}

export interface TypingEvent {
  conversationId: string;
  userId?: string;
  userName?: string;
}

export interface SendMessageEvent {
  conversationId: string;
  content: string;
  contentType?: string;
}

export interface NotificationEvent {
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  link?: string;
}
