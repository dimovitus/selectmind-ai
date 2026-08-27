import type { ProviderId } from '../types/settings';

/** Encrypted storage for provider API keys. */
export interface SecretsPort {
  storeApiKey(providerId: ProviderId, key: string): Promise<void>;
  getApiKey(providerId: ProviderId): Promise<string | null>;
  deleteApiKey(providerId: ProviderId): Promise<void>;
  hasApiKey(providerId: ProviderId): Promise<boolean>;
}
