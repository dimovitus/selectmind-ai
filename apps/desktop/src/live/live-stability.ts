import type { OcrLineBox } from './types';

type StabilityEntry = {
  text: string;
  hits: number;
};

export function lineStabilityKey(line: OcrLineBox): string {
  return `${Math.round(line.y / 8)}:${line.text.trim().toLowerCase()}`;
}

export function filterStableOcrLines(
  lines: OcrLineBox[],
  previous: Map<string, StabilityEntry>,
  requiredHits = 2,
): { stableLines: OcrLineBox[]; nextState: Map<string, StabilityEntry> } {
  const next = new Map<string, StabilityEntry>();
  const stable: OcrLineBox[] = [];

  for (const line of lines) {
    const key = lineStabilityKey(line);
    const text = line.text.trim();
    if (!text) continue;

    const prior = previous.get(key);
    const hits = prior?.text === text ? prior.hits + 1 : 1;
    next.set(key, { text, hits });

    if (hits >= requiredHits) {
      stable.push({ ...line, text });
    }
  }

  return { stableLines: stable, nextState: next };
}
