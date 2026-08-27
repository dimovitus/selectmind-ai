import { describe, expect, it } from 'vitest';
import { buildOverlayLinesFromSourceLines } from './live-overlay-display';
import type { OcrLineBox } from './types';

function line(text: string, y: number, x = 10): OcrLineBox {
  return { text, x, y, width: 80, height: 16 };
}

describe('buildOverlayLinesFromSourceLines', () => {
  it('maps each OCR line to its own overlay box', () => {
    const lines = [line('START', 10), line('SETTINGS', 40)];
    const translations = new Map([
      ['START', 'НАЧАТЬ'],
      ['SETTINGS', 'НАСТРОЙКИ'],
    ]);
    const overlay = buildOverlayLinesFromSourceLines(lines, translations, new Map(), {
      textsSimilar: () => false,
    });
    expect(overlay).toHaveLength(2);
    expect(overlay[0]?.translatedText).toBe('НАЧАТЬ');
    expect(overlay[0]?.y).toBe(10);
    expect(overlay[1]?.translatedText).toBe('НАСТРОЙКИ');
  });

  it('falls back to source when showSourceOnMiss is set', () => {
    const lines = [line('QUIT', 10)];
    const overlay = buildOverlayLinesFromSourceLines(lines, new Map(), new Map(), {
      showSourceOnMiss: true,
      textsSimilar: () => false,
    });
    expect(overlay[0]?.translatedText).toBe('QUIT');
  });

  it('reuses persisted translation on similar miss', () => {
    const lines = [line('Hello', 10)];
    const persisted = new Map([
      [
        '1:0',
        {
          line: {
            id: '1:0',
            sourceText: 'Hello',
            translatedText: 'Привет',
            x: 10,
            y: 10,
            width: 80,
            height: 16,
          },
          misses: 0,
        },
      ],
    ]);
    const overlay = buildOverlayLinesFromSourceLines(lines, new Map(), persisted, {
      textsSimilar: (a, b) => a === b,
    });
    expect(overlay[0]?.translatedText).toBe('Привет');
  });
});
