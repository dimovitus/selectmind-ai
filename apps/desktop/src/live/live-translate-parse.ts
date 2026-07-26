export function parseNumberedTranslationResponse(
  raw: string,
  expectedCount: number,
): string[] | null {
  const lines = raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^\d+[\).\:-]\s*/, '').trim())
    .filter(Boolean);

  if (lines.length === expectedCount) return lines;
  return null;
}
