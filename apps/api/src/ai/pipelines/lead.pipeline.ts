import { getAIProvider } from '../index';
import { LEAD_EXTRACTION_PROMPT } from '../prompts/lead';
import type { LeadResult, ConversationMessage } from '@mojeeb/shared-types';
import { logger } from '../../config/logger';

export class LeadPipeline {
  async extract(message: string, history: ConversationMessage[]): Promise<LeadResult | null> {
    try {
      const provider = getAIProvider('OPENAI');

      const result = await provider.generateJSON<{
        isLead: boolean;
        confidence: number;
        name: string | null;
        email: string | null;
        phone: string | null;
        company: string | null;
        interests: string[];
        budget: string | null;
        timeline: string | null;
        notes: string;
      }>({
        systemPrompt: LEAD_EXTRACTION_PROMPT,
        messages: [...history.slice(-10), { role: 'user', content: message }],
        temperature: 0.2,
        maxTokens: 300,
      });

      if (!result.isLead || result.confidence < 0.5) {
        return null;
      }

      return {
        name: result.name,
        email: result.email,
        phone: result.phone,
        company: result.company,
        interests: result.interests || [],
        budget: result.budget,
        timeline: result.timeline,
        confidence: result.confidence,
        notes: result.notes || '',
      };
    } catch (err) {
      logger.error({ err }, 'Lead extraction failed');
      return null;
    }
  }
}

export const leadPipeline = new LeadPipeline();
