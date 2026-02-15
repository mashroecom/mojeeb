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
