import { engineRequiresNetwork } from './engine-label';
import type { LiveTranslationEngine } from './live-settings';
import { DEFAULT_LIVE_TRANSLATE_SETTINGS } from './live-settings';

export const ONLINE_POLL_INTERVAL_MS = 450;
export const OFFLINE_POLL_INTERVAL_MS = 300;

export function recommendedPollIntervalMs(translationEngine: LiveTranslationEngine): number {
  return engineRequiresNetwork(translationEngine)
    ? ONLINE_POLL_INTERVAL_MS
    : OFFLINE_POLL_INTERVAL_MS;
}

export function resolveLivePollIntervalMs(
  translationEngine: LiveTranslationEngine,
  configuredPollIntervalMs: number,
): number {
  if (
    !engineRequiresNetwork(translationEngine) &&
    configuredPollIntervalMs === DEFAULT_LIVE_TRANSLATE_SETTINGS.pollIntervalMs
  ) {
    return OFFLINE_POLL_INTERVAL_MS;
  }
  if (
    engineRequiresNetwork(translationEngine) &&
    configuredPollIntervalMs === OFFLINE_POLL_INTERVAL_MS
  ) {
    return ONLINE_POLL_INTERVAL_MS;
  }
  return configuredPollIntervalMs;
}
