import { MessageContentType } from './models';

// ========================
// Channel Types
// ========================

export interface InboundMessage {
  externalMessageId: string;
  senderId: string;
  senderName?: string;
  senderPhone?: string;
  senderEmail?: string;
  content: string;
  contentType: MessageContentType;
  mediaUrl?: string;
  timestamp: Date;
  rawPayload: unknown;
}

export interface OutboundMessage {
  recipientId: string;
  content: string;
  contentType: MessageContentType;
  mediaUrl?: string;
}

export interface ChannelCredentials {
  accessToken: string;
  phoneNumberId?: string;
  pageId?: string;
  igAccountId?: string;
  [key: string]: string | undefined;
}

export interface SendResult {
  externalId: string;
  success: boolean;
  error?: string;
}
