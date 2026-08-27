import { describe, expect, it } from 'vitest';
import { parseNumberedTranslationResponse } from './live-translate-parse';

describe('parseNumberedTranslationResponse', () => {
  it('parses numbered provider output', () => {
    const parsed = parseNumberedTranslationResponse('1. First\n2. Second', 2);
    expect(parsed).toEqual(['First', 'Second']);
  });

  it('accepts alternate numbering punctuation', () => {
    const parsed = parseNumberedTranslationResponse('1) Alpha\n2: Beta', 2);
    expect(parsed).toEqual(['Alpha', 'Beta']);
  });

  it('returns null when line count mismatches', () => {
    expect(parseNumberedTranslationResponse('1. Only one', 2)).toBeNull();
  });
});
