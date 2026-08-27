import { readJson, writeJson } from '../storage/local-store';

const LIVE_SETTINGS_KEY = 'live-translate-settings';

export type LiveTranslationEngine =
  | 'google-free'
  | 'bing-free'
  | 'google-proxy'
  | 'local-libretranslate'
  | 'local-nmt'
  | 'ai-provider';

/** Full-screen mode mirrors RetroArch AI Service: OCR the whole monitor. */
export type LiveCoverageMode = 'screen' | 'region';

/**
 * on-demand — press hotkey/button once to translate, press again to clear (RetroArch style).
 * continuous — keep scanning and updating the overlay until toggled off.
 */
export type LiveTriggerMode = 'on-demand' | 'continuous';

/**
 * full — OCR the whole capture region (hotkey default).
 * dialogue-band — bottom ~42% (subtitles).
 * top-band — top ~35% (menus / HUD).
 */
export type LiveScanFocus = 'full' | 'dialogue-band' | 'top-band';

export interface LiveTranslateSettings {
  /** When to run OCR+translate. */
  triggerMode: LiveTriggerMode;
  /** Poll interval while continuous mode is active (ms). */
  pollIntervalMs: number;
  /** Target language (ISO code or label, e.g. ru / Russian). */
  targetLanguage: string;
  /** BCP-47 tag for Windows OCR (en, ja, ru…). Use auto only if unsure. */
  ocrLanguage: string;
  /** Source language for translate APIs (auto-detect ok for online engines). */
  sourceLanguage: string;
  /** Where to OCR in full-screen continuous mode. */
  scanFocus: LiveScanFocus;
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
  triggerMode: 'on-demand',
  pollIntervalMs: 450,
  targetLanguage: 'ru',
  // eng-only OCR turns Cyrillic into Latin lookalikes ("Ничего" → "HIYEro").
  ocrLanguage: 'auto',
  sourceLanguage: 'auto',
  scanFocus: 'dialogue-band',
  translationEngine: 'google-free',
  lingvaBaseUrl: 'https://lingva.ml',
  localLibreTranslateUrl: 'http://127.0.0.1:5000',
  autoFallback: true,
  overlayOpacity: 0.85,
  fontScale: 1,
  maxRequestsPerMinute: 30,
};

/**
 * Storage can contain junk from older builds (nulls, renamed keys, wrong
 * types). Keep only values whose type matches the default, so defaults always
 * fill the gaps and Tauri commands never receive invalid args.
 */
function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function sanitizeStoredSettings(
  stored: Partial<LiveTranslateSettings>,
  validEngines: ReadonlySet<LiveTranslationEngine>,
): Partial<LiveTranslateSettings> {
  const result: Record<string, unknown> = {};
  for (const [key, fallback] of Object.entries(DEFAULT_LIVE_TRANSLATE_SETTINGS)) {
    const value = (stored as Record<string, unknown>)[key];
    if (value === null || value === undefined) continue;
    if (typeof value !== typeof fallback) continue;
    result[key] = value;
  }

  const trigger = result['triggerMode'];
  if (trigger !== 'on-demand' && trigger !== 'continuous') {
    delete result['triggerMode'];
  }

  const scanFocus = result['scanFocus'];
  if (scanFocus !== 'full' && scanFocus !== 'dialogue-band' && scanFocus !== 'top-band') {
    delete result['scanFocus'];
  }

  const engine = result['translationEngine'];
  if (typeof engine !== 'string' || !validEngines.has(engine as LiveTranslationEngine)) {
    delete result['translationEngine'];
  }

  result['pollIntervalMs'] = clampNumber(
    result['pollIntervalMs'],
    250,
    2000,
    DEFAULT_LIVE_TRANSLATE_SETTINGS.pollIntervalMs,
  );
  result['overlayOpacity'] = clampNumber(
    result['overlayOpacity'],
    0.4,
    1,
    DEFAULT_LIVE_TRANSLATE_SETTINGS.overlayOpacity,
  );
  result['fontScale'] = clampNumber(
    result['fontScale'],
    0.7,
    1.6,
    DEFAULT_LIVE_TRANSLATE_SETTINGS.fontScale,
  );
  result['maxRequestsPerMinute'] = clampNumber(
    result['maxRequestsPerMinute'],
    5,
    120,
    DEFAULT_LIVE_TRANSLATE_SETTINGS.maxRequestsPerMinute,
  );

  return result as Partial<LiveTranslateSettings>;
}

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
  if (next.ocrLanguage === 'English') next.ocrLanguage = 'en';
  if (next.ocrLanguage === 'Russian') next.ocrLanguage = 'ru';
  if (next.ocrLanguage === 'Japanese') next.ocrLanguage = 'ja';
  if (next.ocrLanguage === 'Chinese') next.ocrLanguage = 'zh-Hans';
  return next;
}

export function readLiveTranslateSettings(): LiveTranslateSettings {
  const stored = readJson<Partial<LiveTranslateSettings>>(LIVE_SETTINGS_KEY, {});
  const validEngines = new Set(LIVE_TRANSLATION_ENGINE_OPTIONS.map((option) => option.id));
  return {
    ...DEFAULT_LIVE_TRANSLATE_SETTINGS,
    ...normalizeStoredSettings(sanitizeStoredSettings(stored, validEngines)),
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
    label: 'Google Translate (free) — not ideal for Continuous',
    description:
      'Unofficial public endpoint. Fine for on-demand; Continuous mode risks 429/captcha — prefer Offline NMT.',
  },
  {
    id: 'bing-free',
    label: 'Bing Translator (free) — not ideal for Continuous',
    description:
      'Unofficial Bing web endpoint (line-by-line). Slow under load; not recommended for Continuous mode.',
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
    label: 'Offline NMT (Argos) — ~0 ms network latency',
    description:
      'Fully offline via Argos sidecar. Best for Continuous mode. Download the language model below first.',
  },
  {
    id: 'ai-provider',
    label: 'AI provider (fallback)',
    description: 'Uses your configured default AI provider and API key.',
  },
];
