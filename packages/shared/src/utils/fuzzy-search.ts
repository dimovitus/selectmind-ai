export function fuzzyMatch(query: string, text: string): number {
  const q = query.toLowerCase().trim();
  const t = text.toLowerCase();
  if (!q) return 1;
  if (t.includes(q)) return 100 - t.indexOf(q);

  let score = 0;
  let ti = 0;
  for (const char of q) {
    const found = t.indexOf(char, ti);
    if (found === -1) return 0;
    score += 100 - found;
    ti = found + 1;
  }
  return score;
}

export function fuzzyFilter<T>(
  items: T[],
  query: string,
  getText: (item: T) => string,
): T[] {
  if (!query.trim()) return items;

  return items
    .map((item) => ({ item, score: fuzzyMatch(query, getText(item)) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((r) => r.item);
}
