import { getAIProvider } from '../index';
import { EMOTION_DETECTION_PROMPT } from '../prompts/emotion';
import type { EmotionResult, ConversationMessage } from '@mojeeb/shared-types';
import { logger } from '../../config/logger';

export class EmotionPipeline {
  async detect(
    message: string,
    conversationHistory: ConversationMessage[]
  ): Promise<EmotionResult> {
    try {
      const provider = getAIProvider('OPENAI');

      const result = await provider.generateJSON<EmotionResult>({
        systemPrompt: EMOTION_DETECTION_PROMPT,
        messages: [
          ...conversationHistory.slice(-3),
          { role: 'user', content: message },
        ],
        temperature: 0.1,
        maxTokens: 150,
      });

      return {
        emotion: result.emotion || 'neutral',
        score: Math.min(1, Math.max(0, result.score || 0.5)),
        reasoning: result.reasoning || '',
      };
    } catch (err) {
      logger.error({ err }, 'Emotion detection failed');
      return { emotion: 'neutral', score: 0.5, reasoning: 'Detection failed' };
    }
  }
}

export const emotionPipeline = new EmotionPipeline();
