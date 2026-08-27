import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearLiveDiagnostics,
  formatLiveDiagnosticsForCopy,
  getLiveDiagnostics,
  recordLiveTick,
  type LiveTickDiagnostic,
} from './live-diagnostics';

const sampleTick = (overrides: Partial<LiveTickDiagnostic> = {}): LiveTickDiagnostic => ({
  at: Date.now(),
  coverage: 'screen',
  triggerMode: 'on-demand',
  scanFocus: 'full',
  frameUnchanged: false,
  rawLineCount: 2,
  stableLineCount: 1,
  overlayLineCount: 1,
  engineUsed: 'bing-free',
  meanLuma: 120,
  lumaRange: 80,
  width: 1920,
  height: 1080,
  ocrLanguage: 'en',
  rateLimited: false,
  roiAreaPct: 12,
  ocrScope: 'roi',
  cacheHitRatio: 0.95,
  error: null,
  ...overrides,
});

describe('live diagnostics ring buffer', () => {
  beforeEach(() => {
    clearLiveDiagnostics();
  });

  it('stores ticks locally and caps history', () => {
    for (let index = 0; index < 55; index += 1) {
      recordLiveTick(sampleTick({ rawLineCount: index }));
    }
    expect(getLiveDiagnostics()).toHaveLength(50);
    expect(getLiveDiagnostics()[0]?.rawLineCount).toBe(5);
  });

  it('formats copy-friendly report without network calls', () => {
    recordLiveTick(sampleTick({ error: 'translate failed' }));
    const report = formatLiveDiagnosticsForCopy();
    expect(report).toContain('local only');
    expect(report).toContain('mode=on-demand');
    expect(report).toContain('roi=12%');
    expect(report).toContain('cacheHit=95%');
    expect(report).toContain('error=translate failed');
  });
});
