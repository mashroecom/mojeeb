import type { AIProvider } from './providers/base.provider';
import { OpenAIProvider } from './providers/openai.provider';
import { AnthropicProvider } from './providers/anthropic.provider';

const providers = new Map<string, AIProvider>();

export function getAIProvider(provider: string): AIProvider {
  if (!providers.has(provider)) {
    switch (provider) {
      case 'OPENAI':
        providers.set(provider, new OpenAIProvider());
        break;
      case 'ANTHROPIC':
        providers.set(provider, new AnthropicProvider());
        break;
      default:
        throw new Error(`Unknown AI provider: ${provider}`);
    }
  }
  return providers.get(provider)!;
}

/**
 * Provider for the side tasks that are not tied to an agent's own model (analysis,
 * summaries, routing, template suggestions). OpenAI when it is configured (the
 * original behaviour), otherwise Claude — so an installation with only an
 * Anthropic key still gets emotion detection, lead capture and summaries.
 */
export async function getAuxiliaryProvider(): Promise<AIProvider> {
  const has = async (key: string): Promise<boolean> => {
    try {
      const { configService } = await import('../services/config.service');
      return Boolean((await configService.get(key))?.trim());
    } catch {
      return Boolean(process.env[key]?.trim());
    }
  };
  if (await has('OPENAI_API_KEY')) return getAIProvider('OPENAI');
  if (await has('ANTHROPIC_API_KEY')) return getAIProvider('ANTHROPIC');
  return getAIProvider('OPENAI');
}
