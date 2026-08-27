import { listOfflineModels, isOfflinePairInstalled, type ModelListItem } from './offline-models';
import type { LiveTranslateSettings, LiveTranslationEngine } from './live-settings';

const MODELS_CACHE_MS = 60_000;

let cachedItems: ModelListItem[] | null = null;
let cacheFetchedAt = 0;

async function getCachedModelItems(): Promise<ModelListItem[]> {
  const now = Date.now();
  if (cachedItems && now - cacheFetchedAt < MODELS_CACHE_MS) {
    return cachedItems;
  }
  const list = await listOfflineModels();
  cachedItems = list.items;
  cacheFetchedAt = now;
  return cachedItems;
}

/** Invalidate after model download/delete in settings UI. */
export function invalidateOfflineModelCache(): void {
  cachedItems = null;
  cacheFetchedAt = 0;
}

export function offlineReadyForPair(
  items: ModelListItem[],
  sourceLanguage: string,
  targetLanguage: string,
): boolean {
  const target = targetLanguage.trim().toLowerCase();
  if (sourceLanguage === 'auto') {
    return items.some((item) => item.installed && item.toCode.toLowerCase() === target);
  }
  return isOfflinePairInstalled(items, sourceLanguage, targetLanguage);
}

/**
 * Always honour the user's selected engine. Silent override to local-nmt when a
 * model exists was an anti-pattern: users who pick Google for game slang must
 * get Google. Fallback local-nmt → google-free still runs inside Rust when the
 * chosen local engine fails.
 */
export function pickTranslationEngine(
  settings: LiveTranslateSettings,
  _items: ModelListItem[],
): LiveTranslationEngine {
  return settings.translationEngine;
}

/** Suggested default for a fresh install when an offline pair is already present. */
export function suggestedDefaultEngine(items: ModelListItem[]): LiveTranslationEngine {
  // Prefer offline on first run when a model is ready — wow latency; user can
  // still switch to Google/Bing explicitly afterward.
  if (offlineReadyForPair(items, 'auto', 'ru') || offlineReadyForPair(items, 'en', 'ru')) {
    return 'local-nmt';
  }
  return 'google-free';
}

export async function resolveEffectiveTranslationEngine(
  settings: LiveTranslateSettings,
): Promise<LiveTranslationEngine> {
  const items = await getCachedModelItems();
  return pickTranslationEngine(settings, items);
}

/** Used when persisting first-run settings (no prior localStorage entry). */
export async function resolveFreshInstallEngine(): Promise<LiveTranslationEngine> {
  const items = await getCachedModelItems();
  return suggestedDefaultEngine(items);
}
