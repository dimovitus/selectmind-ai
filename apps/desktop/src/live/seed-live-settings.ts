import { writeJson } from '../storage/local-store';
import { resolveFreshInstallEngine } from './live-engine-resolve';
import {
  DEFAULT_LIVE_TRANSLATE_SETTINGS,
  type LiveTranslateSettings,
} from './live-settings';

const LIVE_SETTINGS_KEY = 'live-translate-settings';

/** Persist first-run defaults once; prefer offline NMT when a model is already installed. */
export async function seedLiveTranslateSettingsIfNeeded(): Promise<void> {
  if (localStorage.getItem(`selectmind:${LIVE_SETTINGS_KEY}`) != null) return;
  const engine = await resolveFreshInstallEngine();
  const initial: LiveTranslateSettings = {
    ...DEFAULT_LIVE_TRANSLATE_SETTINGS,
    translationEngine: engine,
  };
  writeJson(LIVE_SETTINGS_KEY, initial);
}
