import { getAIProvider } from '../index';
import type { ConversationMessage, EnhancedSummary } from '@mojeeb/shared-types';
import { logger } from '../../config/logger';

const ENHANCED_SUMMARY_PROMPT = `You are a conversation analyzer. Given the recent messages of a customer support conversation, generate a structured analysis.

Respond in JSON:
{
  "summary": "1-2 sentence summary (in the customer's language, under 200 chars)",
  "topics": ["topic1", "topic2"],
  "customerIntent": "inquiry"|"complaint"|"purchase"|"support"|"feedback"|"other",
  "resolutionStatus": "resolved"|"unresolved"|"partial"|"escalated"
}

Rules:
- Summary in the SAME language the customer uses
- Topics should be 1-4 short descriptive tags
- Be accurate about resolution status based on conversation flow
- Output ONLY valid JSON`;

export class SummaryPipeline {
  /**
   * Generate a structured summary of the conversation from its recent messages.
   * Uses GPT-4o-mini with JSON mode to keep costs low.
   */
  async generate(messages: ConversationMessage[]): Promise<EnhancedSummary | null> {
    if (messages.length === 0) return null;

    try {
      const provider = getAIProvider('OPENAI');

      const result = await provider.generateJSON<EnhancedSummary>({
        systemPrompt: ENHANCED_SUMMARY_PROMPT,
        messages,
        temperature: 0.3,
        maxTokens: 200,
        model: 'gpt-4o-mini',
      });

      return {
        summary: (result.summary || '').slice(0, 200),
        topics: (result.topics || []).slice(0, 4),
        customerIntent: result.customerIntent || 'other',
        resolutionStatus: result.resolutionStatus || 'unresolved',
      };
    } catch (err) {
      logger.error({ err }, 'Enhanced summary generation failed');
      return null;
    }
  }
}

export const summaryPipeline = new SummaryPipeline();
