import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { config } from '../../config';
import { AIProvider } from './base.provider';
import { configService } from '../../services/config.service';
import type { AIResponse, AIGenerationParams } from '@mojeeb/shared-types';

export class AnthropicProvider extends AIProvider {
  readonly name = 'ANTHROPIC';
  private client: Anthropic | null = null;
  private cachedAnthropicKey: string = '';
  private openaiClient: OpenAI | null = null; // For embeddings (Anthropic doesn't have embedding API)
  private cachedOpenaiKey: string = '';

  /**
   * Get or lazily create the Anthropic client.
   * Recreates the client if the API key has changed (e.g. updated via admin dashboard).
   * Falls back to static config if configService fails.
   */
  private async getClient(): Promise<Anthropic> {
    let apiKey: string;
    try {
      apiKey = await configService.get('ANTHROPIC_API_KEY');
    } catch {
      apiKey = config.ai.anthropicApiKey;
    }
    if (!apiKey) {
      apiKey = config.ai.anthropicApiKey;
    }

    if (!this.client || apiKey !== this.cachedAnthropicKey) {
      this.client = new Anthropic({ apiKey, timeout: 60_000 });
      this.cachedAnthropicKey = apiKey;
    }

    return this.client;
  }

  /**
   * Get or lazily create the OpenAI client (used for embeddings).
   * Recreates the client if the API key has changed.
   * Falls back to static config if configService fails.
   */
  private async getOpenAIClient(): Promise<OpenAI> {
    let apiKey: string;
    try {
      apiKey = await configService.get('OPENAI_API_KEY');
    } catch {
      apiKey = config.ai.openaiApiKey;
    }
    if (!apiKey) {
      apiKey = config.ai.openaiApiKey;
    }

    if (!this.openaiClient || apiKey !== this.cachedOpenaiKey) {
      this.openaiClient = new OpenAI({ apiKey });
      this.cachedOpenaiKey = apiKey;
    }

    return this.openaiClient;
  }

  async generateResponse(params: AIGenerationParams): Promise<AIResponse> {
    const client = await this.getClient();
    const response = await client.messages.create({
      model: params.model || 'claude-sonnet-4-20250514',
      max_tokens: params.maxTokens,
      system: params.systemPrompt,
      messages: params.messages.map((m) => {
        const role = m.role === 'user' ? ('user' as const) : ('assistant' as const);
        if (typeof m.content === 'string') {
          return { role, content: m.content };
        }
        // Multimodal content (vision)
        return {
          role,
          content: m.content.map((part) => {
            if (part.type === 'text') {
              return { type: 'text' as const, text: part.text };
            }
            // Extract base64 data from data URL
            const base64Match = part.imageUrl.match(/^data:(image\/[^;]+);base64,(.+)$/);
            if (base64Match && base64Match[1] && base64Match[2]) {
              return {
                type: 'image' as const,
                source: {
                  type: 'base64' as const,
                  media_type: base64Match[1] as
                    | 'image/jpeg'
                    | 'image/png'
                    | 'image/gif'
                    | 'image/webp',
                  data: base64Match[2],
                },
              };
            }
            // Fallback: URL-based
            return {
              type: 'image' as const,
              source: {
                type: 'url' as const,
                url: part.imageUrl,
              },
            };
          }),
        };
      }),
      temperature: params.temperature,
    });

    const textBlock = response.content.find((b) => b.type === 'text');

    return {
      content: textBlock?.type === 'text' ? textBlock.text : '',
      tokensUsed: {
        prompt: response.usage.input_tokens,
        completion: response.usage.output_tokens,
        total: response.usage.input_tokens + response.usage.output_tokens,
      },
      model: response.model,
      finishReason: response.stop_reason || 'end_turn',
    };
  }

  async generateJSON<T>(params: AIGenerationParams): Promise<T> {
    const modifiedPrompt = `${params.systemPrompt}\n\nYou MUST respond with valid JSON only. No other text.`;
    const response = await this.generateResponse({
      ...params,
      systemPrompt: modifiedPrompt,
    });

    // Extract JSON from response (handle markdown code blocks)
    let jsonStr = response.content.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }
    try {
      return JSON.parse(jsonStr) as T;
    } catch (parseErr) {
      throw new Error('Failed to parse Anthropic response as JSON');
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    // Use OpenAI for embeddings since Anthropic doesn't offer embedding API
    const openaiClient = await this.getOpenAIClient();
    const response = await openaiClient.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    });
    if (!response.data[0]?.embedding) {
      throw new Error('No embedding returned from OpenAI API');
    }
    return response.data[0].embedding;
  }
}
