import type { ProviderId } from '@/domain/shared/ids';
import type { ProviderId as CoreProviderId } from '@selectmind/core';
import { getExtensionPlatform } from '@/platform/extension';
import { ChromeSecretsAdapter } from '@/platform/extension/chrome-secrets.adapter';

function secrets() {
  return getExtensionPlatform().secrets;
}

function asCoreId(id: ProviderId): CoreProviderId {
  return id as CoreProviderId;
}

/** @deprecated Prefer getContainer().platform.secrets — kept for gradual migration. */
export async function storeApiKey(providerId: ProviderId, key: string): Promise<void> {
  await secrets().storeApiKey(asCoreId(providerId), key);
}

export async function getApiKey(providerId: ProviderId): Promise<string | null> {
  return secrets().getApiKey(asCoreId(providerId));
}

export async function deleteApiKey(providerId: ProviderId): Promise<void> {
  await secrets().deleteApiKey(asCoreId(providerId));
}

export async function hasApiKey(providerId: ProviderId): Promise<boolean> {
  return secrets().hasApiKey(asCoreId(providerId));
}

export async function loadAllApiKeys(
  providerIds: ProviderId[],
): Promise<Map<ProviderId, string>> {
  const adapter = secrets();
  if (adapter instanceof ChromeSecretsAdapter) {
    const loaded = await adapter.loadAllApiKeys(providerIds.map(asCoreId));
    return new Map(
      [...loaded.entries()].map(([id, key]) => [id as ProviderId, key] as const),
    );
  }

  const keys = new Map<ProviderId, string>();
  for (const id of providerIds) {
    const key = await secrets().getApiKey(asCoreId(id));
    if (key) keys.set(id, key);
  }
  return keys;
}
