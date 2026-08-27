import { readJson, writeJson } from '../storage/local-store';

const CACHE_KEY = 'live-translate-cache';
const CACHE_VERSION = 2;
export const TRANSLATION_CACHE_MAX_ENTRIES = 500;
export const TRANSLATION_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
/** Flush dirty memory → localStorage at most this often (tick path stays sync-free). */
export const TRANSLATION_CACHE_FLUSH_MS = 5_000;

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

let memory: TranslationCacheStore | null = null;
let dirty = false;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let unloadHooked = false;

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

function loadStoreFromDisk(): TranslationCacheStore {
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

function ensureUnloadHook(): void {
  if (unloadHooked || typeof window === 'undefined') return;
  unloadHooked = true;
  window.addEventListener('beforeunload', () => {
    flushTranslationCacheNow();
  });
}

function scheduleFlush(): void {
  dirty = true;
  ensureUnloadHook();
  if (flushTimer !== null) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flushTranslationCacheNow();
  }, TRANSLATION_CACHE_FLUSH_MS);
}

/** Persist in-memory cache immediately (tests / shutdown). */
export function flushTranslationCacheNow(): void {
  if (flushTimer !== null) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (!dirty || !memory) return;
  writeJson(CACHE_KEY, memory);
  dirty = false;
}

function store(): TranslationCacheStore {
  if (!memory) {
    memory = pruneTranslationCache(loadStoreFromDisk());
    dirty = false;
  }
  return memory;
}

function commit(next: TranslationCacheStore): void {
  memory = next;
  scheduleFlush();
}

export function pruneTranslationCache(
  storeInput: TranslationCacheStore,
  now = Date.now(),
): TranslationCacheStore {
  const entries = { ...storeInput.entries };
  let order = storeInput.order.filter((key) => {
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

function touchEntry(current: TranslationCacheStore, key: string, now: number): TranslationCacheStore {
  const entry = current.entries[key];
  if (!entry) return current;

  return {
    ...current,
    entries: {
      ...current.entries,
      [key]: { ...entry, updatedAt: now },
    },
    order: [...current.order.filter((item) => item !== key), key],
  };
}

/** Read-only peek — no LRU touch, no disk I/O. */
export function peekCachedTranslation(
  sourceText: string,
  targetLanguage: string,
): string | null {
  const now = Date.now();
  const key = cacheKey(sourceText, targetLanguage);
  const entry = store().entries[key];
  if (!entry) return null;
  if (now - entry.updatedAt > TRANSLATION_CACHE_TTL_MS) return null;
  return entry.value;
}

export function getCachedTranslation(
  sourceText: string,
  targetLanguage: string,
): string | null {
  const now = Date.now();
  const key = cacheKey(sourceText, targetLanguage);
  let current = pruneTranslationCache(store(), now);
  const entry = current.entries[key];

  if (!entry) {
    if (current !== store()) commit(current);
    return null;
  }

  current = touchEntry(current, key, now);
  commit(current);
  return entry.value;
}

export function setCachedTranslation(
  sourceText: string,
  targetLanguage: string,
  translatedText: string,
): void {
  const now = Date.now();
  const key = cacheKey(sourceText, targetLanguage);
  let current = pruneTranslationCache(store(), now);

  current = {
    ...current,
    entries: {
      ...current.entries,
      [key]: { value: translatedText, updatedAt: now },
    },
    order: [...current.order.filter((item) => item !== key), key],
  };
  current = pruneTranslationCache(current, now);
  commit(current);
}

export function clearTranslationCache(): void {
  memory = emptyStore();
  dirty = true;
  flushTranslationCacheNow();
}

export function getTranslationCacheStats(): TranslationCacheStats {
  const current = pruneTranslationCache(store());
  if (current !== store()) commit(current);
  return {
    count: current.order.length,
    maxEntries: TRANSLATION_CACHE_MAX_ENTRIES,
    ttlHours: TRANSLATION_CACHE_TTL_MS / (60 * 60 * 1000),
  };
}

/** @internal test helper */
export function readTranslationCacheStoreForTests(): TranslationCacheStore {
  flushTranslationCacheNow();
  return loadStoreFromDisk();
}

/** @internal test helper — drop in-memory state between tests. */
export function resetTranslationCacheMemoryForTests(): void {
  if (flushTimer !== null) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  memory = null;
  dirty = false;
}
