import { getAIProvider } from '../index';
import { ROUTING_DECISION_PROMPT } from '../prompts/routing';
import type { RoutingDecision, ConversationMessage, EmotionResult } from '@mojeeb/shared-types';
import { logger } from '../../config/logger';

const HUMAN_REQUEST_PATTERNS = [
  /talk to (a |an )?(human|agent|person|representative)/i,
  /speak (to|with) (a )?(human|agent|person|someone)/i,
  /real person/i,
  /اريد التحدث مع (شخص|موظف|إنسان|انسان)/,
  /ممكن (احد|أحد) يساعدني/,
  /أريد (شخص|موظف) حقيقي/,
  /وصلني (بـ|ب)(موظف|شخص)/,
  /كلم(ني|وني)? (موظف|شخص)/,
];

export class RoutingPipeline {
  async decide(
    message: string,
    history: ConversationMessage[],
    emotion: EmotionResult | null
  ): Promise<RoutingDecision> {
    // Rule-based checks first (fast, no API call)
    if (HUMAN_REQUEST_PATTERNS.some((p) => p.test(message))) {
      return {
        shouldHandoff: true,
        reason: 'Customer explicitly requested human agent',
        confidence: 1.0,
      };
    }

    // High anger/frustration threshold
    if (
      emotion &&
      ['angry', 'frustrated'].includes(emotion.emotion) &&
      emotion.score > 0.8
    ) {
      return {
        shouldHandoff: true,
        reason: `High ${emotion.emotion} detected (score: ${emotion.score})`,
        confidence: emotion.score,
      };
    }

    // Check for repeated customer messages (AI unable to help)
    const customerMessages = history
      .filter((m) => m.role === 'user')
      .slice(-3)
      .map((m) => (typeof m.content === 'string' ? m.content : '').toLowerCase().trim());

    if (customerMessages.length >= 3) {
      const unique = new Set(customerMessages);
      if (unique.size === 1) {
        return {
          shouldHandoff: true,
          reason: 'Customer repeating same message - AI likely unhelpful',
          confidence: 0.8,
        };
      }
    }

    // AI-based routing for ambiguous cases
    try {
      const provider = getAIProvider('OPENAI');
      const result = await provider.generateJSON<{
        handoff: boolean;
        reason: string;
        confidence: number;
      }>({
        systemPrompt: ROUTING_DECISION_PROMPT,
        messages: [
          ...history.slice(-5),
          { role: 'user', content: message },
        ],
        temperature: 0.1,
        maxTokens: 150,
      });

      return {
        shouldHandoff: result.handoff || false,
        reason: result.reason || '',
        confidence: Math.min(1, Math.max(0, result.confidence || 0)),
      };
    } catch (err) {
      logger.error({ err }, 'Routing decision failed');
      return { shouldHandoff: false, reason: 'Routing check failed', confidence: 0 };
    }
  }
}

export const routingPipeline = new RoutingPipeline();
