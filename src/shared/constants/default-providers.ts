import type { ProviderConfig } from '@/domain/provider/provider.schema';
import type { ProviderId } from '@/domain/shared/ids';
import { now } from '@/domain/shared/ids';

function provider(
  id: string,
  name: string,
  type: 'cloud' | 'local',
  adapterType: ProviderConfig['adapterType'],
  baseUrl: string,
  defaultModel: string,
): ProviderConfig {
  const timestamp = now();
  return {
    id: id as ProviderId,
    name,
    type,
    adapterType,
    baseUrl,
    defaultModel,
    enabled: false,
    capabilities: {
      streaming: true,
      vision: adapterType !== 'anthropic',
      functionCalling: adapterType === 'openai-compatible',
    },
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export const DEFAULT_PROVIDERS: ProviderConfig[] = [
  provider(
    'prov_openai',
    'OpenAI',
    'cloud',
    'openai-compatible',
    'https://api.openai.com/v1',
    'gpt-4o-mini',
  ),
  provider(
    'prov_anthropic',
    'Anthropic',
    'cloud',
    'anthropic',
    'https://api.anthropic.com',
    'claude-sonnet-4-20250514',
  ),
  provider(
    'prov_gemini',
    'Google Gemini',
    'cloud',
    'gemini',
    'https://generativelanguage.googleapis.com/v1beta',
    'gemini-2.0-flash',
  ),
  provider(
    'prov_ollama',
    'Ollama',
    'local',
    'openai-compatible',
    'http://localhost:11434/v1',
    'llama3.2',
  ),
];

export const BUILTIN_PROVIDER_IDS = DEFAULT_PROVIDERS.map((p) => p.id);
