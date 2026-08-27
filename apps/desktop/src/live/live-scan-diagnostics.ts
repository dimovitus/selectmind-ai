import { formatLiveEngineBadge } from './engine-label';
import type { LiveScanResult } from './types';

/** Brightness under which a captured frame counts as blank. */
export const BLANK_FRAME_LUMA = 4;
/** Luma spread under which a frame counts as uniform (capture failure). */
export const BLANK_FRAME_RANGE = 2;

/** Uniform near-black frame = capture failure. A dark game scene still has spread. */
export function isBlankFrame(scan: Pick<LiveScanResult, 'meanLuma' | 'lumaRange'>): boolean {
  return scan.meanLuma <= BLANK_FRAME_LUMA && scan.lumaRange <= BLANK_FRAME_RANGE;
}

/** Surfaces why a scan produced nothing instead of a silent overlay. */
export function describeEmptyScan(
  scan: Pick<LiveScanResult, 'width' | 'height' | 'meanLuma' | 'lumaRange' | 'ocrLanguage'>,
): string {
  const frame = `${scan.width}×${scan.height} · luma ${scan.meanLuma}`;
  if (isBlankFrame(scan)) {
    return `Capture is blank — try borderless windowed · ${frame}`;
  }
  const ocr = scan.ocrLanguage ? ` · ocr ${scan.ocrLanguage}` : '';
  return `No text found · ${frame}${ocr}`;
}

export function shortenError(message: string, max = 100): string {
  const compact = message.replace(/\s+/g, ' ').trim();
  return compact.length <= max ? compact : `${compact.slice(0, max - 1)}…`;
}

export function buildTickStatus(
  scan: Pick<LiveScanResult, 'ocrLanguage'>,
  lineCount: number,
  engineUsed: string | null,
  explicit: string | null,
  tone: 'info' | 'warn' | null,
): string | null {
  if (explicit) return explicit;
  if (tone === 'warn' || lineCount === 0) return null;
  const ocr = scan.ocrLanguage || '?';
  return `${ocr} · ${lineCount} lines · ${formatLiveEngineBadge(engineUsed)}`;
}
