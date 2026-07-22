import type { ProviderConfig } from '@/domain/provider/provider.schema';
import type { ProviderId } from '@/domain/shared/ids';
import type { AIProviderPort } from './ai-provider.port';
import { OpenAICompatibleProvider } from './providers/openai-compatible.provider';
import { AnthropicProvider } from './providers/anthropic.provider';
import { GeminiProvider } from './providers/gemini.provider';

export class ProviderRegistry {
  private providers = new Map<ProviderId, AIProviderPort>();

  register(provider: AIProviderPort): void {
    this.providers.set(provider.id, provider);
  }

  get(id: ProviderId): AIProviderPort | null {
    return this.providers.get(id) ?? null;
  }

  clear(): void {
    this.providers.clear();
  }

  loadFromConfigs(
    configs: ProviderConfig[],
    apiKeys: Map<ProviderId, string>,
  ): void {
    this.clear();

    for (const config of configs) {
      if (!config.enabled) continue;

      const apiKey = apiKeys.get(config.id) ?? '';
      const provider = createProviderAdapter(config, apiKey);
      if (provider) {
        this.register(provider);
      }
    }
  }
}

export function createProviderAdapter(
  config: ProviderConfig,
  apiKey: string,
): AIProviderPort | null {
  switch (config.adapterType) {
    case 'openai-compatible':
      return new OpenAICompatibleProvider(config, apiKey);
    case 'anthropic':
      return new AnthropicProvider(config, apiKey);
    case 'gemini':
      return new GeminiProvider(config, apiKey);
    default:
      return null;
  }
}

export const providerRegistry = new ProviderRegistry();
