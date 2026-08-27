import type { LiveTranslationEngine } from './live-settings';

const ENGINE_BADGE_LABELS: Record<string, string> = {
  'google-free': 'Google',
  'google-proxy': 'Lingva',
  'google-proxy-fallback': 'Google (proxy)',
  'bing-free': 'Bing',
  'ai-provider': 'AI',
  'local-libretranslate': 'LibreTranslate',
  'local-nmt': 'Offline',
  'local-argos': 'Offline',
  none: 'Live',
};

export function formatLiveEngineBadge(engineUsed: string | null | undefined): string {
  if (!engineUsed) return 'Live translate';

  if (engineUsed.includes('→')) {
    const [primary, fallback] = engineUsed.split('→');
    const primaryLabel = ENGINE_BADGE_LABELS[primary ?? ''] ?? primary ?? 'Engine';
    const fallbackLabel = ENGINE_BADGE_LABELS[fallback ?? ''] ?? fallback ?? 'fallback';
    return `${primaryLabel} → ${fallbackLabel}`;
  }

  return ENGINE_BADGE_LABELS[engineUsed] ?? engineUsed;
}

/** True when a network primary fell back to a local engine (show degraded UI). */
export function isOfflineReserveUsed(engineUsed: string | null | undefined): boolean {
  if (!engineUsed?.includes('→')) return false;
  const fallback = engineUsed.split('→')[1] ?? '';
  return fallback.startsWith('local-');
}

export function engineRequiresNetwork(engine: LiveTranslationEngine): boolean {
  return engine !== 'local-nmt' && engine !== 'local-libretranslate';
}

export function isNetworkEngineUsed(engineUsed: string): boolean {
  return !engineUsed.startsWith('local-') && engineUsed !== 'ai-provider';
}
