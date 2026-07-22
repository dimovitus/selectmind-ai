import { describe, it, expect } from 'vitest';
import { fuzzyMatch, fuzzyFilter } from '@/shared/utils/fuzzy-search';

describe('fuzzyMatch', () => {
  it('returns high score for substring match', () => {
    expect(fuzzyMatch('trans', 'Translate')).toBeGreaterThan(0);
  });

  it('returns 0 for no match', () => {
    expect(fuzzyMatch('xyz', 'Translate')).toBe(0);
  });

  it('returns 1 for empty query', () => {
    expect(fuzzyMatch('', 'Anything')).toBe(1);
  });
});

describe('fuzzyFilter', () => {
  const items = [
    { name: 'Translate', id: '1' },
    { name: 'Explain', id: '2' },
    { name: 'Code Review', id: '3' },
  ];

  it('filters and sorts by relevance', () => {
    const result = fuzzyFilter(items, 'code', (i) => i.name);
    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe('Code Review');
  });

  it('returns all items for empty query', () => {
    expect(fuzzyFilter(items, '', (i) => i.name)).toHaveLength(3);
  });
});
