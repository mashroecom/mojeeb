import OpenAI from 'openai';
import { config } from '../../config';
import { AIProvider } from './base.provider';
import { logger } from '../../config/logger';
import { configService } from '../../services/config.service';
import type { AIResponse, AIGenerationParams } from '@mojeeb/shared-types';

export class OpenAIProvider extends AIProvider {
  readonly name = 'OPENAI';
  private client: OpenAI | null = null;
  private cachedApiKey: string = '';

  /**
   * Get or lazily create the OpenAI client.
   * Recreates the client if the API key has changed (e.g. updated via admin dashboard).
   * Falls back to static config if configService fails.
   */
  private async getClient(): Promise<OpenAI> {
    let apiKey: string;
    try {
      apiKey = await configService.get('OPENAI_API_KEY');
    } catch {
      apiKey = config.ai.openaiApiKey;
    }
    if (!apiKey) {
      apiKey = config.ai.openaiApiKey;
    }

    if (!this.client || apiKey !== this.cachedApiKey) {
      this.client = new OpenAI({ apiKey, timeout: 60_000 });
      this.cachedApiKey = apiKey;
    }

    return this.client;
  }

  async generateResponse(params: AIGenerationParams): Promise<AIResponse> {
    const startTime = Date.now();
    const model = params.model || 'gpt-4o';

    const mappedMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = params.messages.map((m) => {
      if (typeof m.content === 'string') {
        if (m.role === 'user') return { role: 'user' as const, content: m.content };
        if (m.role === 'system') return { role: 'system' as const, content: m.content };
        return { role: 'assistant' as const, content: m.content };
      }
      // Multimodal content (vision) — only valid for user messages
      const parts: OpenAI.Chat.Completions.ChatCompletionContentPart[] = m.content.map((part): OpenAI.Chat.Completions.ChatCompletionContentPart => {
        if (part.type === 'text') {
          return { type: 'text' as const, text: part.text };
        }
        return {
          type: 'image_url' as const,
          image_url: {
            url: part.imageUrl,
            detail: (part.detail || 'auto') as 'low' | 'high' | 'auto',
          },
        };
      });
      return { role: 'user' as const, content: parts };
    });

    const openaiMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system' as const, content: params.systemPrompt },
      ...mappedMessages,
    ];

    const client = await this.getClient();
    const response = await client.chat.completions.create({
      model,
      messages: openaiMessages,
      temperature: params.temperature,
      max_tokens: params.maxTokens,
    });

    const durationMs = Date.now() - startTime;
    const usage = response.usage;

    logger.info({
      type: 'openai_request',
      method: 'generateResponse',
      model: response.model,
      temperature: params.temperature,
      maxTokens: params.maxTokens,
      messagesCount: openaiMessages.length,
      systemPromptLength: params.systemPrompt.length,
      inputTokens: usage?.prompt_tokens || 0,
      outputTokens: usage?.completion_tokens || 0,
      totalTokens: usage?.total_tokens || 0,
      cachedTokens: (usage as any)?.prompt_tokens_details?.cached_tokens || 0,
      durationMs,
      finishReason: response.choices[0]?.finish_reason,
      responsePreview: (response.choices[0]?.message?.content || '').slice(0, 100),
    }, `OpenAI [${response.model}] ${usage?.prompt_tokens}in/${usage?.completion_tokens}out = ${usage?.total_tokens}tok (${durationMs}ms)`);

    return {
      content: response.choices[0]?.message?.content || '',
      tokensUsed: {
        prompt: usage?.prompt_tokens || 0,
        completion: usage?.completion_tokens || 0,
        total: usage?.total_tokens || 0,
      },
      model: response.model,
      finishReason: response.choices[0]?.finish_reason || 'stop',
    };
  }

  async generateJSON<T>(params: AIGenerationParams): Promise<T> {
    const startTime = Date.now();
    const model = params.model || 'gpt-4o-mini';

    const openaiMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system' as const, content: params.systemPrompt },
      ...params.messages.map((m) => {
        // generateJSON is text-only (analysis pipeline)
        const content = typeof m.content === 'string' ? m.content : m.content.map((p) => p.type === 'text' ? p.text : '').join(' ');
        if (m.role === 'user') return { role: 'user' as const, content };
        if (m.role === 'system') return { role: 'system' as const, content };
        return { role: 'assistant' as const, content };
      }),
    ];

    const client = await this.getClient();
    const response = await client.chat.completions.create({
      model,
      messages: openaiMessages,
      temperature: params.temperature,
      max_tokens: params.maxTokens,
      response_format: { type: 'json_object' as const },
    });

    const durationMs = Date.now() - startTime;
    const usage = response.usage;
    const content = response.choices[0]?.message?.content || '{}';

    logger.info({
      type: 'openai_request',
      method: 'generateJSON',
      model: response.model,
      temperature: params.temperature,
      maxTokens: params.maxTokens,
      messagesCount: openaiMessages.length,
      systemPromptLength: params.systemPrompt.length,
      inputTokens: usage?.prompt_tokens || 0,
      outputTokens: usage?.completion_tokens || 0,
      totalTokens: usage?.total_tokens || 0,
      cachedTokens: (usage as any)?.prompt_tokens_details?.cached_tokens || 0,
      durationMs,
      responseBody: content,
    }, `OpenAI [${response.model}] ${usage?.prompt_tokens}in/${usage?.completion_tokens}out = ${usage?.total_tokens}tok (${durationMs}ms)`);

    return JSON.parse(content) as T;
  }

  async generateEmbedding(text: string): Promise<number[]> {
    const startTime = Date.now();

    const client = await this.getClient();
    const response = await client.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    });

    const durationMs = Date.now() - startTime;

    logger.info({
      type: 'openai_request',
      method: 'generateEmbedding',
      model: 'text-embedding-3-small',
      inputLength: text.length,
      totalTokens: response.usage?.total_tokens || 0,
      durationMs,
    }, `OpenAI [embedding] ${response.usage?.total_tokens}tok (${durationMs}ms)`);

    return response.data[0]!.embedding;
  }
}
