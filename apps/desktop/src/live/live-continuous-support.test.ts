import { describe, expect, it } from 'vitest';
import { isLiveContinuousCaptureReady } from './live-continuous-support';

describe('isLiveContinuousCaptureReady', () => {
  it('allows continuous on Windows and macOS regardless of probe', () => {
    expect(isLiveContinuousCaptureReady('windows', null)).toBe(true);
    expect(isLiveContinuousCaptureReady('macos', false)).toBe(true);
  });

  it('requires a successful Linux capture probe', () => {
    expect(isLiveContinuousCaptureReady('linux', null)).toBe(false);
    expect(isLiveContinuousCaptureReady('linux', false)).toBe(false);
    expect(isLiveContinuousCaptureReady('linux', true)).toBe(true);
  });
});
