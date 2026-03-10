/**
 * Token Usage Service Stub
 * Created for testing purposes to allow server startup
 */

interface TokenUsageRecord {
  orgId: string;
  agentId?: string;
  conversationId: string;
  model: string;
  provider: string;
  inputTokens: number;
  outputTokens: number;
  pipelineType: string;
}

class TokenUsageService {
  async record(data: TokenUsageRecord): Promise<void> {
    // Stub implementation - no-op for testing
    // In production, this would record token usage to database
    return Promise.resolve();
  }
}

export const tokenUsageService = new TokenUsageService();
