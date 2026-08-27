import type { OcrLineBox } from './types';
import { peekCachedTranslation } from './translation-cache';
import { textMatchesTargetScript } from './live-script';

export interface TranslatePartition {
  /** Source → translation already known (cache hit or same-script skip). */
  resolved: Map<string, string>;
  /** Unique OCR lines that still need a network/local engine call. */
  pendingLines: OcrLineBox[];
  cachedCount: number;
  pendingCount: number;
}

/**
 * Shrink the translate set before HTTP: ROI-merged screens still contain dozens
 * of unchanged strings. Only uncached / non-target-script lines should hit the
 * engine — everything else is assembled from the in-memory Map.
 */
export function partitionLinesForTranslate(
  lines: OcrLineBox[],
  targetLanguage: string,
): TranslatePartition {
  const resolved = new Map<string, string>();
  const pendingLines: OcrLineBox[] = [];
  const pendingSeen = new Set<string>();
  let cachedCount = 0;

  for (const line of lines) {
    const source = line.text.trim();
    if (!source) continue;

    if (textMatchesTargetScript(source, targetLanguage)) {
      resolved.set(source, source);
      cachedCount += 1;
      continue;
    }

    const hit = peekCachedTranslation(source, targetLanguage);
    if (hit) {
      resolved.set(source, hit);
      cachedCount += 1;
      continue;
    }

    if (pendingSeen.has(source)) continue;
    pendingSeen.add(source);
    pendingLines.push(line);
  }

  return {
    resolved,
    pendingLines,
    cachedCount,
    pendingCount: pendingLines.length,
  };
}
