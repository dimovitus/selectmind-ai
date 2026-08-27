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

describe('live translate settings', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createLocalStorageMock());
    vi.resetModules();
  });

  it('fills defaults when storage is empty', async () => {
    const settings = await import('./live-settings');
    expect(settings.readLiveTranslateSettings()).toMatchObject({
      triggerMode: 'on-demand',
      translationEngine: 'google-free',
      scanFocus: 'dialogue-band',
      ocrLanguage: 'auto',
      sourceLanguage: 'auto',
    });
  });

  it('drops invalid stored values and clamps numbers', async () => {
    localStorage.setItem(
      'selectmind:live-translate-settings',
      JSON.stringify({
        triggerMode: 'broken',
        scanFocus: 'invalid',
        translationEngine: 'not-real',
        pollIntervalMs: 9999,
        overlayOpacity: 2,
        maxRequestsPerMinute: 1,
      }),
    );

    const settings = await import('./live-settings');
    const resolved = settings.readLiveTranslateSettings();
    expect(resolved.triggerMode).toBe('on-demand');
    expect(resolved.scanFocus).toBe('dialogue-band');
    expect(resolved.translationEngine).toBe('google-free');
    expect(resolved.pollIntervalMs).toBeLessThanOrEqual(2000);
    expect(resolved.overlayOpacity).toBeLessThanOrEqual(1);
    expect(resolved.maxRequestsPerMinute).toBeGreaterThanOrEqual(5);
  });

  it('normalizes legacy language labels on write', async () => {
    const settings = await import('./live-settings');
    const next = settings.writeLiveTranslateSettings({
      targetLanguage: 'Russian',
      sourceLanguage: 'English',
      ocrLanguage: 'Japanese',
    });
    expect(next.targetLanguage).toBe('ru');
    expect(next.sourceLanguage).toBe('en');
    expect(next.ocrLanguage).toBe('ja');
  });
});
