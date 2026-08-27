import { describe, expect, it } from 'vitest';
import { pickTranslationEngine, suggestedDefaultEngine } from './live-engine-resolve';
import { DEFAULT_LIVE_TRANSLATE_SETTINGS } from './live-settings';
import type { ModelListItem } from './offline-models';

const enRuInstalled: ModelListItem[] = [
  {
    id: 'en-ru',
    fromCode: 'en',
    fromName: 'English',
    toCode: 'ru',
    toName: 'Russian',
    packageVersion: '1',
    downloadUrl: '',
    sizeBytes: 1,
    installed: true,
    installedSizeBytes: 1,
  },
];

describe('pickTranslationEngine', () => {
  it('honours explicit google-free even when offline pair is installed', () => {
    const engine = pickTranslationEngine(
      { ...DEFAULT_LIVE_TRANSLATE_SETTINGS, translationEngine: 'google-free' },
      enRuInstalled,
    );
    expect(engine).toBe('google-free');
  });

  it('honours explicit bing-free even when offline pair is installed', () => {
    const engine = pickTranslationEngine(
      { ...DEFAULT_LIVE_TRANSLATE_SETTINGS, translationEngine: 'bing-free' },
      enRuInstalled,
    );
    expect(engine).toBe('bing-free');
  });

  it('honours explicit local-nmt', () => {
    const engine = pickTranslationEngine(
      { ...DEFAULT_LIVE_TRANSLATE_SETTINGS, translationEngine: 'local-nmt' },
      enRuInstalled,
    );
    expect(engine).toBe('local-nmt');
  });

  it('keeps google-free when offline is unavailable', () => {
    const engine = pickTranslationEngine(
      { ...DEFAULT_LIVE_TRANSLATE_SETTINGS, translationEngine: 'google-free' },
      [],
    );
    expect(engine).toBe('google-free');
  });
});

describe('suggestedDefaultEngine', () => {
  it('suggests local-nmt when en→ru is installed', () => {
    expect(suggestedDefaultEngine(enRuInstalled)).toBe('local-nmt');
  });

  it('suggests google-free when nothing is installed', () => {
    expect(suggestedDefaultEngine([])).toBe('google-free');
  });
});
