import { getAIProvider } from '../index';
import type { ConversationMessage } from '@mojeeb/shared-types';
import { logger } from '../../config/logger';

const SUMMARY_SYSTEM_PROMPT = `You are a conversation summarizer. Given the recent messages of a customer support conversation, generate a concise 1-2 sentence summary.
Rules:
- Respond in the SAME language the customer is using.
- Focus on the customer's main issue or request.
- Keep it under 200 characters.
- Output ONLY the summary text, nothing else.`;

export class SummaryPipeline {
  /**
   * Generate a short summary of the conversation from its recent messages.
   * Uses GPT-4o-mini to keep costs low.
   */
  async generate(messages: ConversationMessage[]): Promise<string | null> {
    if (messages.length === 0) return null;

    try {
      const provider = getAIProvider('OPENAI');

      const result = await provider.generateResponse({
        systemPrompt: SUMMARY_SYSTEM_PROMPT,
        messages,
        temperature: 0.3,
        maxTokens: 150,
        model: 'gpt-4o-mini',
      });

      return result.content.trim() || null;
    } catch (err) {
      logger.error({ err }, 'Summary generation failed');
      return null;
    }
  }
}

export const summaryPipeline = new SummaryPipeline();
