import { readJson, writeJson } from '../storage/local-store';

const LIVE_SETTINGS_KEY = 'live-translate-settings';

export type LiveTranslationEngine =
  | 'google-free'
  | 'bing-free'
  | 'google-proxy'
  | 'local-libretranslate'
  | 'local-nmt'
  | 'ai-provider';

export interface LiveTranslateSettings {
  /** Poll interval while live mode is active (ms). */
  pollIntervalMs: number;
  /** Target language (ISO code or label, e.g. ru / Russian). */
  targetLanguage: string;
  /** Source language for OCR text (use English for most games). */
  sourceLanguage: string;
  /** Translation backend for live overlay. */
  translationEngine: LiveTranslationEngine;
  /** Lingva-compatible proxy base URL (google-proxy / fallback). */
  lingvaBaseUrl: string;
  /** LibreTranslate server base URL (local-libretranslate engine). */
  localLibreTranslateUrl: string;
  /** Try other online engines when the primary one fails. */
  autoFallback: boolean;
  /** Overlay background opacity 0–1. */
  overlayOpacity: number;
  /** Font size multiplier for translated text. */
  fontScale: number;
  /** Max translation API calls per minute (cost guard). */
  maxRequestsPerMinute: number;
}

export const DEFAULT_LIVE_TRANSLATE_SETTINGS: LiveTranslateSettings = {
  pollIntervalMs: 450,
  targetLanguage: 'ru',
  sourceLanguage: 'en',
  translationEngine: 'google-free',
  lingvaBaseUrl: 'https://lingva.ml',
  localLibreTranslateUrl: 'http://127.0.0.1:5000',
  autoFallback: true,
  overlayOpacity: 0.82,
  fontScale: 1,
  maxRequestsPerMinute: 30,
};

function normalizeStoredSettings(
  partial: Partial<LiveTranslateSettings>,
): Partial<LiveTranslateSettings> {
  const next = { ...partial };
  if (next.targetLanguage === 'Russian') next.targetLanguage = 'ru';
  if (next.targetLanguage === 'English') next.targetLanguage = 'en';
  if (next.targetLanguage === 'Ukrainian') next.targetLanguage = 'uk';
  if (next.sourceLanguage === 'English') next.sourceLanguage = 'en';
  if (next.sourceLanguage === 'Russian') next.sourceLanguage = 'ru';
  if (next.sourceLanguage === 'Ukrainian') next.sourceLanguage = 'uk';
  return next;
}

export function readLiveTranslateSettings(): LiveTranslateSettings {
  const stored = readJson<Partial<LiveTranslateSettings>>(LIVE_SETTINGS_KEY, {});
  return {
    ...DEFAULT_LIVE_TRANSLATE_SETTINGS,
    ...normalizeStoredSettings(stored),
  };
}

export function writeLiveTranslateSettings(
  partial: Partial<LiveTranslateSettings>,
): LiveTranslateSettings {
  const updated = {
    ...readLiveTranslateSettings(),
    ...normalizeStoredSettings(partial),
  };
  writeJson(LIVE_SETTINGS_KEY, updated);
  return updated;
}

export const LIVE_TRANSLATION_ENGINE_OPTIONS: Array<{
  id: LiveTranslationEngine;
  label: string;
  description: string;
}> = [
  {
    id: 'google-free',
    label: 'Google Translate (free, no key)',
    description: 'Unofficial public endpoint. Auto-fallback to proxy on rate limit.',
  },
  {
    id: 'bing-free',
    label: 'Bing / Microsoft Translator (free, no key)',
    description: 'Unofficial Bing web endpoint (same approach as Yolochka). Requires internet.',
  },
  {
    id: 'google-proxy',
    label: 'Google via Lingva proxy',
    description: 'Uses a Lingva instance so your IP is not rate-limited as quickly.',
  },
  {
    id: 'local-libretranslate',
    label: 'LibreTranslate (local server)',
    description:
      'Offline-capable when you run LibreTranslate on localhost (default port 5000). No bundled server yet.',
  },
  {
    id: 'local-nmt',
    label: 'Offline NMT (Argos)',
    description:
      'Fully offline translation via bundled Argos sidecar. Download the language model below first.',
  },
  {
    id: 'ai-provider',
    label: 'AI provider (fallback)',
    description: 'Uses your configured default AI provider and API key.',
  },
];
