import type { AIResponse, ConversationMessage, AIGenerationParams } from '@mojeeb/shared-types';

export abstract class AIProvider {
  abstract readonly name: string;

  abstract generateResponse(params: AIGenerationParams): Promise<AIResponse>;

  abstract generateEmbedding(text: string): Promise<number[]>;

  abstract generateJSON<T>(params: AIGenerationParams): Promise<T>;
}
