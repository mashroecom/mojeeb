// ========================
// Enums
// ========================

export enum OrgRole {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  MEMBER = 'MEMBER',
}

export enum AiProvider {
  OPENAI = 'OPENAI',
  ANTHROPIC = 'ANTHROPIC',
}

export enum ChannelType {
  WHATSAPP = 'WHATSAPP',
  MESSENGER = 'MESSENGER',
  INSTAGRAM = 'INSTAGRAM',
  WEBCHAT = 'WEBCHAT',
}

export enum ConversationStatus {
  ACTIVE = 'ACTIVE',
  HANDED_OFF = 'HANDED_OFF',
  WAITING = 'WAITING',
  RESOLVED = 'RESOLVED',
  ARCHIVED = 'ARCHIVED',
}

export enum MessageRole {
  CUSTOMER = 'CUSTOMER',
  AI_AGENT = 'AI_AGENT',
  HUMAN_AGENT = 'HUMAN_AGENT',
  SYSTEM = 'SYSTEM',
}

export enum MessageContentType {
  TEXT = 'TEXT',
  IMAGE = 'IMAGE',
  AUDIO = 'AUDIO',
  VIDEO = 'VIDEO',
  DOCUMENT = 'DOCUMENT',
  LOCATION = 'LOCATION',
  CONTACT = 'CONTACT',
  TEMPLATE = 'TEMPLATE',
}

export enum DeliveryStatus {
  QUEUED = 'QUEUED',
  SENT = 'SENT',
  DELIVERED = 'DELIVERED',
  READ = 'READ',
  FAILED = 'FAILED',
}

export enum SubscriptionPlan {
  FREE = 'FREE',
  STARTER = 'STARTER',
  PROFESSIONAL = 'PROFESSIONAL',
  ENTERPRISE = 'ENTERPRISE',
}

export enum SubscriptionStatus {
  ACTIVE = 'ACTIVE',
  PAST_DUE = 'PAST_DUE',
  CANCELED = 'CANCELED',
  TRIALING = 'TRIALING',
}

export enum LeadStatus {
  NEW = 'NEW',
  CONTACTED = 'CONTACTED',
  QUALIFIED = 'QUALIFIED',
  CONVERTED = 'CONVERTED',
  LOST = 'LOST',
}

export enum EmbeddingStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export enum PaymentGateway {
  KASHIER = 'KASHIER',
  STRIPE = 'STRIPE',
  PAYPAL = 'PAYPAL',
}

// ========================
// Subscription Plan Limits
// ========================

export const PLAN_LIMITS = {
  [SubscriptionPlan.FREE]: {
    messagesPerMonth: 100,
    maxAgents: 1,
    maxChannels: Infinity,
    maxKnowledgeBases: 1,
    maxTeamMembers: 3,
    apiAccess: false,
  },
  [SubscriptionPlan.STARTER]: {
    messagesPerMonth: 1000,
    maxAgents: 2,
    maxChannels: Infinity,
    maxKnowledgeBases: 3,
    maxTeamMembers: 3,
    apiAccess: false,
  },
  [SubscriptionPlan.PROFESSIONAL]: {
    messagesPerMonth: 10000,
    maxAgents: 5,
    maxChannels: Infinity,
    maxKnowledgeBases: 10,
    maxTeamMembers: 10,
    apiAccess: true,
  },
  [SubscriptionPlan.ENTERPRISE]: {
    messagesPerMonth: Infinity,
    maxAgents: Infinity,
    maxChannels: Infinity,
    maxKnowledgeBases: Infinity,
    maxTeamMembers: Infinity,
    apiAccess: true,
  },
} as const;
