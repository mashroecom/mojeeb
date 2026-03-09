// ========================
// AI Types
// ========================

export interface AIResponse {
  content: string;
  tokensUsed: {
    prompt: number;
    completion: number;
    total: number;
  };
  model: string;
  finishReason: string;
}

export interface EmotionResult {
  emotion: EmotionCategory;
  score: number;
  reasoning: string;
}

export type EmotionCategory =
  | 'happy'
  | 'satisfied'
  | 'neutral'
  | 'confused'
  | 'frustrated'
  | 'angry'
  | 'sad'
  | 'urgent';

export interface RoutingDecision {
  shouldHandoff: boolean;
  reason: string;
  confidence: number;
}

export interface LeadResult {
  name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  interests: string[];
  budget: string | null;
  timeline: string | null;
  confidence: number;
  notes: string;
}

// Multimodal content parts for vision-capable models
export interface TextContentPart {
  type: 'text';
  text: string;
}

export interface ImageContentPart {
  type: 'image_url';
  imageUrl: string;    // base64 data URL or HTTP URL
  mimeType: string;    // e.g. 'image/jpeg'
  detail?: 'low' | 'high' | 'auto';
}

export type ContentPart = TextContentPart | ImageContentPart;

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string | ContentPart[];
}

export interface AIGenerationParams {
  systemPrompt: string;
  messages: ConversationMessage[];
  temperature: number;
  maxTokens: number;
  model?: string;
}

// ========================
// Enterprise AI Types
// ========================

export interface ExtractedCustomerData {
  name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  address: string | null;
  orderNumber: string | null;
}

export interface DataCollectionConfig {
  requiredFields: string[];
  collectionStrategy: 'natural' | 'upfront' | 'end';
  customFields: { name: string; type: string; label: string; labelAr: string }[];
  confirmationEnabled: boolean;
}

export interface QuickRepliesConfig {
  enabled: boolean;
  maxButtons: number;
  aiSuggestions: boolean;
  predefinedSets: {
    trigger: string;
    buttons: { text: string; textAr: string }[];
  }[];
}

export interface EnhancedSummary {
  summary: string;
  topics: string[];
  customerIntent: string;
  resolutionStatus: string;
}
