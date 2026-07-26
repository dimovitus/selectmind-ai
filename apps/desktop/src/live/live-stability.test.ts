import { describe, expect, it } from 'vitest';
import { filterStableOcrLines } from './live-stability';
import type { OcrLineBox } from './types';

function line(text: string, y = 100): OcrLineBox {
  return { text, x: 0, y, width: 100, height: 20 };
}

describe('live stability filter', () => {
  it('requires two matching frames before emitting a line', () => {
    const first = filterStableOcrLines([line('Hello')], new Map());
    expect(first.stableLines).toHaveLength(0);

    const second = filterStableOcrLines([line('Hello')], first.nextState);
    expect(second.stableLines).toHaveLength(1);
    expect(second.stableLines[0]?.text).toBe('Hello');
  });

  it('resets when text changes at the same slot', () => {
    const first = filterStableOcrLines([line('Hel')], new Map());
    const second = filterStableOcrLines([line('Hello')], first.nextState);
    expect(second.stableLines).toHaveLength(0);
  });

  it('skips frame hash churn for unrelated slots independently', () => {
    const first = filterStableOcrLines([line('Line A', 40), line('Line B', 120)], new Map());
    const second = filterStableOcrLines([line('Line A', 40), line('Line B', 120)], first.nextState);
    expect(second.stableLines.map((item) => item.text)).toEqual(['Line A', 'Line B']);
  });
});
