import type { LiveCoverageMode, LiveScanFocus, LiveTriggerMode } from './live-settings';

/** One live-translate tick — stored locally only, never sent off-device. */
export interface LiveTickDiagnostic {
  at: number;
  coverage: LiveCoverageMode;
  triggerMode: LiveTriggerMode;
  scanFocus: LiveScanFocus;
  frameUnchanged: boolean;
  rawLineCount: number;
  stableLineCount: number;
  overlayLineCount: number;
  engineUsed: string | null;
  meanLuma: number;
  lumaRange: number;
  width: number;
  height: number;
  ocrLanguage: string;
  rateLimited: boolean;
  /** Dirty 8×8 cell share (0–100). */
  roiAreaPct: number;
  /** `skip` | `roi` | `full` */
  ocrScope: string;
  /** 0–1: share of on-screen lines served from translation cache / script skip. */
  cacheHitRatio: number;
  overlayViewportWidth?: number;
  overlayScaleCorrection?: number;
  error: string | null;
}

const MAX_ENTRIES = 50;
const entries: LiveTickDiagnostic[] = [];

export function recordLiveTick(tick: LiveTickDiagnostic): void {
  entries.push(tick);
  if (entries.length > MAX_ENTRIES) {
    entries.shift();
  }
}

export function getLiveDiagnostics(): readonly LiveTickDiagnostic[] {
  return entries;
}

export function clearLiveDiagnostics(): void {
  entries.length = 0;
}

export function formatLiveDiagnosticsForCopy(): string {
  const lines = [
    'SelectMind AI — live translate diagnostics (local only)',
    `Captured at ${new Date().toISOString()}`,
    `Entries: ${entries.length}/${MAX_ENTRIES}`,
    '',
  ];

  if (entries.length === 0) {
    lines.push('No ticks recorded yet. Start live translate, then copy again.');
    return lines.join('\n');
  }

  for (const [index, tick] of entries.entries()) {
    lines.push(
      [
        `#${index + 1} ${new Date(tick.at).toISOString()}`,
        `  mode=${tick.triggerMode} coverage=${tick.coverage} focus=${tick.scanFocus}`,
        `  frame=${tick.width}×${tick.height} luma=${tick.meanLuma} range=${tick.lumaRange} ocr=${tick.ocrLanguage}`,
        `  lines raw=${tick.rawLineCount} stable=${tick.stableLineCount} overlay=${tick.overlayLineCount}`,
        `  roi=${tick.roiAreaPct.toFixed(0)}% scope=${tick.ocrScope} cacheHit=${(tick.cacheHitRatio * 100).toFixed(0)}%`,
        `  engine=${tick.engineUsed ?? 'none'} unchanged=${tick.frameUnchanged} rateLimited=${tick.rateLimited}`,
        tick.error ? `  error=${tick.error}` : null,
      ]
        .filter(Boolean)
        .join('\n'),
    );
  }

  return lines.join('\n');
}
