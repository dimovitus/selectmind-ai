/**
 * Detect when OCR text is already in the target writing system so we skip
 * a no-op (or harmful) network translate — e.g. Russian UI with target=ru.
 */
export function textMatchesTargetScript(text: string, targetLanguage: string): boolean {
  const target = targetLanguage.trim().toLowerCase().split(/[-_]/)[0] ?? '';
  const letters = [...text].filter((ch) => /\p{L}/u.test(ch));
  if (letters.length < 3) return false;

  const cyrillic = letters.filter((ch) => /\p{Script=Cyrillic}/u.test(ch)).length;
  const latin = letters.filter((ch) => /\p{Script=Latin}/u.test(ch)).length;
  const cyrRatio = cyrillic / letters.length;
  const latinRatio = latin / letters.length;

  if (target === 'ru' || target === 'uk' || target === 'be' || target === 'bg') {
    return cyrRatio >= 0.55;
  }

  if (
    target === 'en' ||
    target === 'de' ||
    target === 'fr' ||
    target === 'es' ||
    target === 'it' ||
    target === 'pt' ||
    target === 'pl' ||
    target === 'nl' ||
    target === 'sv' ||
    target === 'cs' ||
    target === 'tr'
  ) {
    return latinRatio >= 0.7 && cyrRatio < 0.15;
  }

  return false;
}
