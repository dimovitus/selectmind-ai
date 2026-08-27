import type { OcrLineBox } from './types';

type StabilityEntry = {
  text: string;
  hits: number;
};

/**
 * Exact strings the overlay itself can render. Anything else — including game
 * dialogue that happens to contain these words — stays translatable.
 */
const OVERLAY_UI_STRINGS = new Set(
  [
    'scanning',
    'translating',
    'confirming text',
    'no text found in region',
    'live translate',
    'rate limited — waiting',
    'rate limited - waiting',
  ].map((entry) => entry.toLowerCase()),
);

const OVERLAY_HOTKEY_HINT = /^(ctrl|alt|shift|meta)\s*\+.*—\s*(stop|clear)$/i;

/** Diagnostic strings the overlay pill can render (self-OCR guard). */
const OVERLAY_STATUS_LINE = /^(no text found|capture is blank)\s*·|^region \d+\/\d+$/i;

/**
 * Mixed Latin+Cyrillic salad and single-glyph token spam are almost never real
 * UI copy — they come from icons, tray glyphs, and failed eng+rus OCR.
 */
export function isLikelyOcrGarbage(text: string): boolean {
  const trimmed = text.trim();
  // Bare filenames/extensions are not dialogue — leave the file manager alone.
  if (/^[\w.-]+\.\w{1,8}$/u.test(trimmed)) return true;

  // Decorative strips: 0000, ====, |||| — length > 3 with ≤2 unique chars.
  if (trimmed.length > 3) {
    const unique = new Set([...trimmed.replace(/\s+/gu, '')]);
    if (unique.size > 0 && unique.size <= 2) return true;
  }

  // No vowels → usually glyph noise, unless a short abbreviation (HP, MP, EXP).
  const lettersOnly = trimmed.replace(/[^\p{L}]/gu, '');
  if (lettersOnly.length >= 4 && !/[aeiouyаеёиоуыэюя]/iu.test(lettersOnly)) {
    return true;
  }

  const letters = [...trimmed].filter((ch) => /\p{L}/u.test(ch));
  if (letters.length < 2) return false;

  const cyrillic = letters.filter((ch) => /\p{Script=Cyrillic}/u.test(ch)).length;
  const latin = letters.filter((ch) => /\p{Script=Latin}/u.test(ch)).length;
  if (cyrillic > 0 && latin > 0) {
    const dominant = Math.max(cyrillic, latin) / letters.length;
    if (dominant < 0.78) return true;
  }

  const tokens = trimmed.split(/\s+/u).filter(Boolean);
  if (tokens.length >= 3) {
    // Single-letter Russian words (а/и/в) are real — only reject tokens that are
    // punctuation-only or mix Latin+Cyrillic inside one glyph cluster.
    const broken = tokens.filter((token) => {
      const tokenLetters = [...token].filter((ch) => /\p{L}/u.test(ch));
      if (tokenLetters.length === 0) return true;
      const cyr = tokenLetters.filter((ch) => /\p{Script=Cyrillic}/u.test(ch)).length;
      const lat = tokenLetters.filter((ch) => /\p{Script=Latin}/u.test(ch)).length;
      return cyr > 0 && lat > 0;
    });
    if (broken.length / tokens.length >= 0.4) return true;
  }

  return false;
}

export function isReadableOcrLine(text: string): boolean {
  const trimmed = text.trim().replace(/[.…]+$/u, '');
  if (trimmed.length < 2) return false;
  if (OVERLAY_UI_STRINGS.has(trimmed.toLowerCase())) return false;
  if (OVERLAY_HOTKEY_HINT.test(trimmed)) return false;
  if (OVERLAY_STATUS_LINE.test(trimmed)) return false;
  if (isLikelyOcrGarbage(trimmed)) return false;

  const nonSpace = trimmed.replace(/\s+/gu, '');
  const alnum = trimmed.match(/[\p{L}\p{N}]/gu);
  const alnumCount = alnum?.length ?? 0;
  if (alnumCount < 2) return false;

  // Symbol salad ("= . — Г . r =а") is OCR noise from stylized fonts, not text.
  if (alnumCount / nonSpace.length < 0.5) return false;

  const tokens = trimmed.split(/\s+/u);
  const avgTokenLen = nonSpace.length / tokens.length;
  // Longer blocks (descriptions) often include short words — only apply the
  // noise heuristic to compact single-line OCR hits.
  if (trimmed.length < 48 && tokens.length >= 5 && avgTokenLen < 1.6) return false;

  return true;
}

export function lineStabilityKey(line: OcrLineBox): string {
  // Bucket by row and column so side-by-side lines do not share a slot.
  return `${Math.round(line.y / 12)}:${Math.round(line.x / 32)}`;
}

export function textsSimilar(a: string, b: string): boolean {
  const left = a.trim().toLowerCase();
  const right = b.trim().toLowerCase();
  if (!left || !right) return false;
  if (left === right) return true;
  if (left.includes(right) || right.includes(left)) return true;

  const minLen = Math.min(left.length, right.length);
  if (minLen === 0) return false;

  let same = 0;
  for (let index = 0; index < minLen; index += 1) {
    if (left[index] === right[index]) same += 1;
  }

  return same / minLen >= 0.72;
}

/**
 * Stricter than textsSimilar — used only to drop overlay echo in OCR output.
 * Avoids suppressing short in-game words ("OK", "Go") that happen to appear
 * inside a longer translated line.
 */
export function isLikelyOverlayEcho(displayed: string, candidate: string): boolean {
  const left = displayed.trim().toLowerCase();
  const right = candidate.trim().toLowerCase();
  if (!left || !right) return false;
  if (left === right) return true;

  const minSubstrLen = 8;
  if (left.length >= minSubstrLen && right.length >= minSubstrLen) {
    if (left.includes(right) || right.includes(left)) return true;
  }

  const minLen = Math.min(left.length, right.length);
  if (minLen >= 12) {
    return textsSimilar(left, right);
  }

  return false;
}

export function filterStableOcrLines(
  lines: OcrLineBox[],
  previous: Map<string, StabilityEntry>,
  requiredHits = 1,
): { stableLines: OcrLineBox[]; nextState: Map<string, StabilityEntry> } {
  const next = new Map<string, StabilityEntry>();
  const stable: OcrLineBox[] = [];

  for (const line of lines) {
    const text = line.text.trim();
    if (!isReadableOcrLine(text)) continue;

    const key = lineStabilityKey(line);
    const prior = previous.get(key);
    const matchesPrior = prior ? textsSimilar(prior.text, text) : false;
    const hits = matchesPrior ? prior!.hits + 1 : 1;
    const storedText =
      matchesPrior && prior!.text.length > text.length ? prior!.text : text;

    next.set(key, { text: storedText, hits });

    if (hits >= requiredHits) {
      stable.push({ ...line, text: storedText });
    }
  }

  return { stableLines: stable, nextState: next };
}
