// ========================
// API Request/Response Types
// ========================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  details?: unknown;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface CursorPaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    cursor: string | null;
    hasMore: boolean;
    limit: number;
  };
}

// Auth
export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  organizationName: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
  };
  tokens: AuthTokens;
  organization: {
    id: string;
    name: string;
    slug: string;
  };
}

// Agent
export interface CreateAgentRequest {
  name: string;
  description?: string;
  aiProvider: string;
  aiModel: string;
  systemPrompt: string;
  temperature?: number;
  maxTokens?: number;
  language?: string;
  enableEmotionDetection?: boolean;
  enableLeadExtraction?: boolean;
  enableHumanHandoff?: boolean;
  handoffThreshold?: number;
}

// Channel
export interface ConnectChannelRequest {
  type: string;
  name: string;
  credentials: Record<string, string>;
  externalId?: string;
}

// Message
export interface SendMessageRequest {
  content: string;
  contentType?: string;
}

// Analytics
export interface AnalyticsOverview {
  totalConversations: number;
  totalMessages: number;
  totalLeads: number;
  averageResponseTimeMs: number;
  activeConversations: number;
  resolvedConversations: number;
  handoffRate: number;
}

export interface DateRangeQuery {
  startDate: string;
  endDate: string;
}
