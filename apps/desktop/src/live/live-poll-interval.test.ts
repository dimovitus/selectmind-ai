import { describe, expect, it } from 'vitest';
import {
  OFFLINE_POLL_INTERVAL_MS,
  ONLINE_POLL_INTERVAL_MS,
  recommendedPollIntervalMs,
  resolveLivePollIntervalMs,
} from './live-poll-interval';

describe('live poll interval', () => {
  it('recommends faster polling for offline engines', () => {
    expect(recommendedPollIntervalMs('google-free')).toBe(ONLINE_POLL_INTERVAL_MS);
    expect(recommendedPollIntervalMs('local-nmt')).toBe(OFFLINE_POLL_INTERVAL_MS);
  });

  it('uses offline default when engine is offline and user kept factory online default', () => {
    expect(resolveLivePollIntervalMs('local-nmt', ONLINE_POLL_INTERVAL_MS)).toBe(
      OFFLINE_POLL_INTERVAL_MS,
    );
  });

  it('preserves explicit user overrides', () => {
    expect(resolveLivePollIntervalMs('local-nmt', 600)).toBe(600);
    expect(resolveLivePollIntervalMs('google-free', 600)).toBe(600);
  });
});
