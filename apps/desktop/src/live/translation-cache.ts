import { readJson, writeJson } from '../storage/local-store';

const CACHE_KEY = 'live-translate-cache';
const CACHE_VERSION = 2;
export const TRANSLATION_CACHE_MAX_ENTRIES = 500;
export const TRANSLATION_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

interface CacheEntry {
  value: string;
  updatedAt: number;
}

interface TranslationCacheStore {
  version: number;
  entries: Record<string, CacheEntry>;
  order: string[];
}

export interface TranslationCacheStats {
  count: number;
  maxEntries: number;
  ttlHours: number;
}

function cacheKey(sourceText: string, targetLanguage: string): string {
  return `${targetLanguage}::${sourceText.trim().toLowerCase()}`;
}

function emptyStore(): TranslationCacheStore {
  return { version: CACHE_VERSION, entries: {}, order: [] };
}

function migrateLegacyCache(raw: Record<string, string>): TranslationCacheStore {
  const now = Date.now();
  const entries: Record<string, CacheEntry> = {};
  const order: string[] = [];

  for (const [key, value] of Object.entries(raw)) {
    entries[key] = { value, updatedAt: now };
    order.push(key);
  }

  return { version: CACHE_VERSION, entries, order };
}

function loadStore(): TranslationCacheStore {
  const raw = readJson<unknown>(CACHE_KEY, null);
  if (!raw || typeof raw !== 'object') {
    return emptyStore();
  }

  if ('version' in raw && (raw as TranslationCacheStore).version === CACHE_VERSION) {
    const store = raw as TranslationCacheStore;
    return {
      version: CACHE_VERSION,
      entries: store.entries ?? {},
      order: Array.isArray(store.order) ? store.order : Object.keys(store.entries ?? {}),
    };
  }

  return migrateLegacyCache(raw as Record<string, string>);
}

function saveStore(store: TranslationCacheStore): void {
  writeJson(CACHE_KEY, store);
}

export function pruneTranslationCache(
  store: TranslationCacheStore,
  now = Date.now(),
): TranslationCacheStore {
  const entries = { ...store.entries };
  let order = store.order.filter((key) => {
    const entry = entries[key];
    if (!entry) return false;
    if (now - entry.updatedAt > TRANSLATION_CACHE_TTL_MS) {
      delete entries[key];
      return false;
    }
    return true;
  });

  while (order.length > TRANSLATION_CACHE_MAX_ENTRIES) {
    const oldest = order.shift();
    if (oldest) delete entries[oldest];
  }

  return { version: CACHE_VERSION, entries, order };
}

function touchEntry(store: TranslationCacheStore, key: string, now: number): TranslationCacheStore {
  const entry = store.entries[key];
  if (!entry) return store;

  return {
    ...store,
    entries: {
      ...store.entries,
      [key]: { ...entry, updatedAt: now },
    },
    order: [...store.order.filter((item) => item !== key), key],
  };
}

export function getCachedTranslation(
  sourceText: string,
  targetLanguage: string,
): string | null {
  const now = Date.now();
  const key = cacheKey(sourceText, targetLanguage);
  let store = pruneTranslationCache(loadStore(), now);
  const entry = store.entries[key];

  if (!entry) {
    saveStore(store);
    return null;
  }

  store = touchEntry(store, key, now);
  saveStore(store);
  return entry.value;
}

export function setCachedTranslation(
  sourceText: string,
  targetLanguage: string,
  translatedText: string,
): void {
  const now = Date.now();
  const key = cacheKey(sourceText, targetLanguage);
  let store = pruneTranslationCache(loadStore(), now);

  store.entries[key] = { value: translatedText, updatedAt: now };
  store.order = [...store.order.filter((item) => item !== key), key];
  store = pruneTranslationCache(store, now);
  saveStore(store);
}

export function clearTranslationCache(): void {
  saveStore(emptyStore());
}

export function getTranslationCacheStats(): TranslationCacheStats {
  const store = pruneTranslationCache(loadStore());
  return {
    count: store.order.length,
    maxEntries: TRANSLATION_CACHE_MAX_ENTRIES,
    ttlHours: TRANSLATION_CACHE_TTL_MS / (60 * 60 * 1000),
  };
}

/** @internal test helper */
export function readTranslationCacheStoreForTests(): TranslationCacheStore {
  return loadStore();
}
