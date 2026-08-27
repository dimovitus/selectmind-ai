import type { LiveTranslatedLine, OcrLineBox } from './types';

type PersistedLine = { line: LiveTranslatedLine; misses: number };

function lineDisplayId(line: OcrLineBox, usedIds: Set<string>): string {
  const base = `${Math.round(line.y / 12)}:${Math.round(line.x / 24)}`;
  let id = base;
  let bump = 1;
  while (usedIds.has(id)) {
    id = `${base}:${bump}`;
    bump += 1;
  }
  usedIds.add(id);
  return id;
}

/**
 * One overlay box per OCR line, using that line's exact bbox. Preferred for
 * game UI where each label/button must stay anchored to its own text.
 */
export function buildOverlayLinesFromSourceLines(
  lines: OcrLineBox[],
  translations: Map<string, string>,
  persisted: Map<string, PersistedLine>,
  options: {
    showSourceOnMiss?: boolean;
    textsSimilar: (left: string, right: string) => boolean;
  },
): LiveTranslatedLine[] {
  const usedIds = new Set<string>();
  const result: LiveTranslatedLine[] = [];

  for (const line of lines) {
    const source = line.text.trim();
    if (!source) continue;

    const id = lineDisplayId(line, usedIds);
    let translated = translations.get(source) ?? '';

    if (!translated) {
      const prior = persisted.get(id);
      if (prior && options.textsSimilar(prior.line.sourceText, source)) {
        translated = prior.line.translatedText;
      }
    }

    if (!translated && options.showSourceOnMiss) {
      translated = source;
    }

    if (!translated) continue;

    result.push({
      id,
      sourceText: line.text,
      translatedText: translated,
      x: line.x,
      y: line.y,
      width: line.width,
      height: line.height,
    });
  }

  return result;
}
