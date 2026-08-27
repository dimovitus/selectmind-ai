/**
 * Live OCR language for Tesseract / Windows OCR.
 *
 * Game UI is almost always one script. Mixed eng+rus made BACK→BACH.
 * "auto" follows the translation source language (default eng for English games).
 */
export function resolveLiveOcrLanguageTag(
  ocrLanguage: string,
  sourceLanguage: string,
): string {
  const ocr = ocrLanguage.trim().toLowerCase();
  if (ocr && ocr !== 'auto') {
    return ocr;
  }

  const source = sourceLanguage.trim().toLowerCase().split(/[-_]/)[0] ?? '';
  if (!source || source === 'auto') {
    return 'en';
  }
  return source;
}

/** @deprecated Prefer resolveLiveOcrLanguageTag for live translate. */
export function resolveOcrLanguageTag(ocrLanguage: string): string | undefined {
  const tag = ocrLanguage.trim().toLowerCase();
  if (!tag || tag === 'auto') return undefined;
  return tag;
}
