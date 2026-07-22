import type { ProviderId } from '@/domain/shared/ids';

const API_KEY_PREFIX = 'saywa_api_key_';
const CRYPTO_SALT_KEY = 'saywa_crypto_salt';

async function getOrCreateSalt(): Promise<Uint8Array> {
  const stored = await chrome.storage.local.get(CRYPTO_SALT_KEY);
  const existing = stored[CRYPTO_SALT_KEY] as string | undefined;

  if (existing) {
    return Uint8Array.from(atob(existing), (c) => c.charCodeAt(0));
  }

  const salt = crypto.getRandomValues(new Uint8Array(16));
  await chrome.storage.local.set({
    [CRYPTO_SALT_KEY]: btoa(String.fromCharCode(...salt)),
  });
  return salt;
}

async function deriveKey(): Promise<CryptoKey> {
  const salt = await getOrCreateSalt();
  const extensionId = chrome.runtime.id;

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(`${extensionId}:saywa-plus`),
    'PBKDF2',
    false,
    ['deriveKey'],
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: new Uint8Array(salt),
      iterations: 100_000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptApiKey(key: string): Promise<string> {
  const cryptoKey = await deriveKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    new TextEncoder().encode(key),
  );

  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);

  return btoa(String.fromCharCode(...combined));
}

export async function decryptApiKey(encrypted: string): Promise<string> {
  const cryptoKey = await deriveKey();
  const combined = Uint8Array.from(atob(encrypted), (c) => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const data = combined.slice(12);

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    data,
  );

  return new TextDecoder().decode(decrypted);
}

export async function storeApiKey(providerId: ProviderId, key: string): Promise<void> {
  const encrypted = await encryptApiKey(key);
  await chrome.storage.local.set({ [`${API_KEY_PREFIX}${providerId}`]: encrypted });
}

export async function getApiKey(providerId: ProviderId): Promise<string | null> {
  const result = await chrome.storage.local.get(`${API_KEY_PREFIX}${providerId}`);
  const encrypted = result[`${API_KEY_PREFIX}${providerId}`] as string | undefined;
  if (!encrypted) return null;

  try {
    return await decryptApiKey(encrypted);
  } catch {
    return null;
  }
}

export async function deleteApiKey(providerId: ProviderId): Promise<void> {
  await chrome.storage.local.remove(`${API_KEY_PREFIX}${providerId}`);
}

export async function loadAllApiKeys(
  providerIds: ProviderId[],
): Promise<Map<ProviderId, string>> {
  const keys = new Map<ProviderId, string>();
  const storageKeys = providerIds.map((id) => `${API_KEY_PREFIX}${id}`);
  const result = await chrome.storage.local.get(storageKeys);

  for (const id of providerIds) {
    const encrypted = result[`${API_KEY_PREFIX}${id}`] as string | undefined;
    if (encrypted) {
      try {
        const decrypted = await decryptApiKey(encrypted);
        keys.set(id, decrypted);
      } catch {
        // skip invalid keys
      }
    }
  }

  return keys;
}

export async function hasApiKey(providerId: ProviderId): Promise<boolean> {
  const key = await getApiKey(providerId);
  return key !== null && key.length > 0;
}
