import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { partitionLinesForTranslate } from './live-translate-partition';
import { resetTranslationCacheMemoryForTests, setCachedTranslation } from './translation-cache';
import type { OcrLineBox } from './types';

function line(text: string): OcrLineBox {
  return { text, x: 0, y: 0, width: 40, height: 12 };
}

function createLocalStorageMock(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key) => map.get(key) ?? null,
    key: (index) => [...map.keys()][index] ?? null,
    removeItem: (key) => {
      map.delete(key);
    },
    setItem: (key, value) => {
      map.set(key, value);
    },
  };
}

describe('partitionLinesForTranslate', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createLocalStorageMock());
    resetTranslationCacheMemoryForTests();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends only cache misses to the network set', () => {
    setCachedTranslation('START', 'ru', 'НАЧАТЬ');
    const part = partitionLinesForTranslate(
      [line('START'), line('SETTINGS'), line('START')],
      'ru',
    );
    expect(part.cachedCount).toBe(2); // START appears twice — both resolved from cache
    expect(part.pendingCount).toBe(1);
    expect(part.pendingLines.map((l) => l.text)).toEqual(['SETTINGS']);
    expect(part.resolved.get('START')).toBe('НАЧАТЬ');
    expect(part.resolved.size).toBe(1); // unique sources in resolved map before SETTINGS nets
  });

  it('treats target-script text as resolved without pending', () => {
    const part = partitionLinesForTranslate([line('Настройки')], 'ru');
    expect(part.pendingCount).toBe(0);
    expect(part.resolved.get('Настройки')).toBe('Настройки');
  });
});
