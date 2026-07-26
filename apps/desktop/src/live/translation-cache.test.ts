import { beforeEach, describe, expect, it, vi } from 'vitest';

function createLocalStorageMock() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
  };
}

describe('translation cache', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createLocalStorageMock());
    vi.resetModules();
  });

  it('stores and reads translations', async () => {
    const cache = await import('./translation-cache');
    cache.setCachedTranslation('Hello', 'ru', 'Привет');
    expect(cache.getCachedTranslation('Hello', 'ru')).toBe('Привет');
  });

  it('evicts oldest entries beyond max size', async () => {
    const cache = await import('./translation-cache');
    for (let index = 0; index < cache.TRANSLATION_CACHE_MAX_ENTRIES + 5; index += 1) {
      cache.setCachedTranslation(`line-${index}`, 'ru', `t-${index}`);
    }

    expect(cache.getCachedTranslation('line-0', 'ru')).toBeNull();
    expect(cache.getCachedTranslation('line-4', 'ru')).toBeNull();
    expect(cache.getCachedTranslation(`line-${cache.TRANSLATION_CACHE_MAX_ENTRIES + 4}`, 'ru')).toBe(
      `t-${cache.TRANSLATION_CACHE_MAX_ENTRIES + 4}`,
    );
    expect(cache.getTranslationCacheStats().count).toBeLessThanOrEqual(
      cache.TRANSLATION_CACHE_MAX_ENTRIES,
    );
  });

  it('expires entries after ttl', async () => {
    vi.useFakeTimers();
    const cache = await import('./translation-cache');
    cache.setCachedTranslation('Quest accepted', 'ru', 'Квест принят');

    vi.setSystemTime(Date.now() + cache.TRANSLATION_CACHE_TTL_MS + 1);
    expect(cache.getCachedTranslation('Quest accepted', 'ru')).toBeNull();
    vi.useRealTimers();
  });

  it('migrates legacy string-only cache entries', async () => {
    localStorage.setItem(
      'selectmind:live-translate-cache',
      JSON.stringify({ 'ru::hello': 'привет' }),
    );
    const cache = await import('./translation-cache');
    expect(cache.getCachedTranslation('hello', 'ru')).toBe('привет');
  });
});
