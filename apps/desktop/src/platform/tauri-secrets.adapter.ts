import { invoke } from '@tauri-apps/api/core';
import type { ProviderId, SecretsPort } from '@selectmind/core';
import { readJson, removeKey } from '../storage/local-store';

const LEGACY_SECRETS_KEY = 'api-keys';

/** Desktop: API keys in the OS credential store (Windows Credential Manager / Secret Service). */
export class TauriSecretsAdapter implements SecretsPort {
  async storeApiKey(providerId: ProviderId, key: string): Promise<void> {
    const trimmed = key.trim();
    if (!trimmed) {
      throw new Error('API key must not be empty');
    }
    await invoke('secret_store_api_key', { providerId, apiKey: trimmed });
  }

  async getApiKey(providerId: ProviderId): Promise<string | null> {
    return invoke<string | null>('secret_get_api_key', { providerId });
  }

  async deleteApiKey(providerId: ProviderId): Promise<void> {
    await invoke('secret_delete_api_key', { providerId });
  }

  async hasApiKey(providerId: ProviderId): Promise<boolean> {
    return invoke<boolean>('secret_has_api_key', { providerId });
  }
}

/** Move plaintext keys from early desktop builds into the OS keychain. */
export async function migrateLegacyApiKeys(secrets: SecretsPort): Promise<number> {
  const legacy = readJson<Record<string, string>>(LEGACY_SECRETS_KEY, {});
  const entries = Object.entries(legacy).filter(([, key]) => Boolean(key?.trim()));

  for (const [providerId, key] of entries) {
    const hasKey = await secrets.hasApiKey(providerId as ProviderId);
    if (!hasKey) {
      await secrets.storeApiKey(providerId as ProviderId, key);
    }
  }

  if (entries.length > 0) {
    removeKey(LEGACY_SECRETS_KEY);
  }

  return entries.length;
}

export async function loadAllApiKeys(
  secrets: SecretsPort,
  providerIds: ProviderId[],
): Promise<Map<ProviderId, string>> {
  const result = new Map<ProviderId, string>();
  await Promise.all(
    providerIds.map(async (id) => {
      const key = await secrets.getApiKey(id);
      if (key) result.set(id, key);
    }),
  );
  return result;
}
