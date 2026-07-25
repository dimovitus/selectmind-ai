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
  // Native adapters
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

  // OpenAI-compatible cloud
  provider(
    'prov_groq',
    'Groq',
    'cloud',
    'openai-compatible',
    'https://api.groq.com/openai/v1',
    'llama-3.3-70b-versatile',
  ),
  provider(
    'prov_mistral',
    'Mistral AI',
    'cloud',
    'openai-compatible',
    'https://api.mistral.ai/v1',
    'mistral-small-latest',
  ),
  provider(
    'prov_deepseek',
    'DeepSeek',
    'cloud',
    'openai-compatible',
    'https://api.deepseek.com/v1',
    'deepseek-chat',
  ),
  provider(
    'prov_xai',
    'xAI (Grok)',
    'cloud',
    'openai-compatible',
    'https://api.x.ai/v1',
    'grok-2-latest',
  ),
  provider(
    'prov_openrouter',
    'OpenRouter',
    'cloud',
    'openai-compatible',
    'https://openrouter.ai/api/v1',
    'openai/gpt-4o-mini',
  ),
  provider(
    'prov_together',
    'Together AI',
    'cloud',
    'openai-compatible',
    'https://api.together.xyz/v1',
    'meta-llama/Llama-3.3-70B-Instruct-Turbo',
  ),
  provider(
    'prov_perplexity',
    'Perplexity',
    'cloud',
    'openai-compatible',
    'https://api.perplexity.ai',
    'sonar',
  ),
  provider(
    'prov_fireworks',
    'Fireworks AI',
    'cloud',
    'openai-compatible',
    'https://api.fireworks.ai/inference/v1',
    'accounts/fireworks/models/llama-v3p3-70b-instruct',
  ),

  // Local OpenAI-compatible servers
  provider(
    'prov_ollama',
    'Ollama',
    'local',
    'openai-compatible',
    'http://localhost:11434/v1',
    'llama3.2',
  ),
  provider(
    'prov_lmstudio',
    'LM Studio',
    'local',
    'openai-compatible',
    'http://localhost:1234/v1',
    'local-model',
  ),
  provider(
    'prov_localai',
    'LocalAI',
    'local',
    'openai-compatible',
    'http://localhost:8080/v1',
    'gpt-4',
  ),
];

export const BUILTIN_PROVIDER_IDS = DEFAULT_PROVIDERS.map((p) => p.id);

export function sortProvidersByBuiltinOrder(providers: ProviderConfig[]): ProviderConfig[] {
  const order = new Map(BUILTIN_PROVIDER_IDS.map((id, index) => [id, index]));
  return [...providers].sort((a, b) => {
    const aIndex = order.get(a.id) ?? Number.MAX_SAFE_INTEGER;
    const bIndex = order.get(b.id) ?? Number.MAX_SAFE_INTEGER;
    if (aIndex !== bIndex) return aIndex - bIndex;
    return a.name.localeCompare(b.name);
  });
}
