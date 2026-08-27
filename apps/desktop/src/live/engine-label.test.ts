import { describe, expect, it } from 'vitest';
import {
  engineRequiresNetwork,
  formatLiveEngineBadge,
  isNetworkEngineUsed,
  isOfflineReserveUsed,
} from './engine-label';

describe('engine-label', () => {
  it('formats known engine badges', () => {
    expect(formatLiveEngineBadge('google-free')).toBe('Google');
    expect(formatLiveEngineBadge('local-nmt')).toBe('Offline');
    expect(formatLiveEngineBadge('local-nmt→bing-free')).toBe('Offline → Bing');
  });

  it('marks offline engines as local-only', () => {
    expect(engineRequiresNetwork('google-free')).toBe(true);
    expect(engineRequiresNetwork('local-nmt')).toBe(false);
    expect(engineRequiresNetwork('local-libretranslate')).toBe(false);
  });

  it('detects network engine usage in overlay badge chain', () => {
    expect(isNetworkEngineUsed('google-free')).toBe(true);
    expect(isNetworkEngineUsed('local-nmt')).toBe(false);
    expect(isNetworkEngineUsed('local-nmt→google-free')).toBe(false);
  });

  it('detects offline reserve after network failure', () => {
    expect(isOfflineReserveUsed('google-free→local-nmt')).toBe(true);
    expect(isOfflineReserveUsed('bing-free→local-nmt')).toBe(true);
    expect(isOfflineReserveUsed('local-nmt→google-free')).toBe(false);
    expect(isOfflineReserveUsed('google-free')).toBe(false);
  });
});
