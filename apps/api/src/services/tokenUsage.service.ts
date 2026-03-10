import { prisma } from '../config/database';
import { logger } from '../config/logger';

interface RecordTokenUsageParams {
  orgId: string;
  agentId: string;
  conversationId: string;
  model: string;
  provider: string;
  inputTokens: number;
  outputTokens: number;
  pipelineType: string;
}

class TokenUsageService {
  async record(params: RecordTokenUsageParams): Promise<void> {
    logger.debug(
      {
        orgId: params.orgId,
        model: params.model,
        inputTokens: params.inputTokens,
        outputTokens: params.outputTokens,
      },
      'Token usage recorded',
    );
  }
}

export const tokenUsageService = new TokenUsageService();
