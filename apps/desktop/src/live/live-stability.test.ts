import { describe, expect, it } from 'vitest';
import {
  filterStableOcrLines,
  isLikelyOverlayEcho,
  isReadableOcrLine,
  textsSimilar,
} from './live-stability';
import type { OcrLineBox } from './types';

function line(text: string, y = 100): OcrLineBox {
  return { text, x: 0, y, width: 100, height: 20 };
}

describe('live stability filter', () => {
  it('emits readable text on the first stable frame', () => {
    const first = filterStableOcrLines([line('Hello world')], new Map());
    expect(first.stableLines).toHaveLength(1);
    expect(first.stableLines[0]?.text).toBe('Hello world');
  });

  it('ignores overlay status strings but keeps real dialogue', () => {
    expect(isReadableOcrLine('Confirming text…')).toBe(false);
    expect(isReadableOcrLine('Live translate')).toBe(false);
    expect(isReadableOcrLine('Ctrl + Shift + L — stop')).toBe(false);
    expect(isReadableOcrLine('No text found · 876×166 · luma 34 · ocr en')).toBe(false);
    expect(isReadableOcrLine('Capture is blank · 1920×1080 · luma 0')).toBe(false);
    expect(isReadableOcrLine('Scanning the ruins for survivors')).toBe(true);
    expect(isReadableOcrLine('Google it later, we move now')).toBe(true);
  });

  it('rejects OCR noise from stylized fonts but keeps short dialogue', () => {
    expect(isReadableOcrLine('= . — Г . r =а ЧР В ес')).toBe(false);
    expect(isReadableOcrLine('| _ - ~ x')).toBe(false);
    expect(isReadableOcrLine('А ну и что')).toBe(true);
    expect(isReadableOcrLine('Привет, мир!')).toBe(true);
    expect(isReadableOcrLine('HP 100')).toBe(true);
  });

  it('rejects mixed-script OCR salad from icons and tray glyphs', () => {
    expect(isReadableOcrLine('ЗЕОН R e')).toBe(false);
    expect(isReadableOcrLine('2B O Ф н')).toBe(false);
    expect(isReadableOcrLine('- i ч \'')).toBe(false);
    expect(isReadableOcrLine('package.json')).toBe(false);
    expect(isReadableOcrLine('manifest.firefox.ts')).toBe(false);
    expect(isReadableOcrLine('Подписаться')).toBe(true);
    expect(isReadableOcrLine('Share')).toBe(true);
  });

  it('rejects decorative unique-char strips and vowel-less noise', () => {
    expect(isReadableOcrLine('00000000')).toBe(false);
    expect(isReadableOcrLine('========')).toBe(false);
    expect(isReadableOcrLine('||||')).toBe(false);
    expect(isReadableOcrLine('Play')).toBe(true);
    expect(isReadableOcrLine('BACK')).toBe(true);
    expect(isReadableOcrLine('HP')).toBe(true);
    expect(isReadableOcrLine('EXP')).toBe(true);
    expect(isReadableOcrLine('BACH')).toBe(true); // real word — OCR quality, not filter
  });

  it('treats similar OCR jitter at the same slot as the same line', () => {
    expect(textsSimilar('Hello world', 'Hello worlc')).toBe(true);
    expect(isLikelyOverlayEcho('Welcome traveler', 'OK')).toBe(false);

    const first = filterStableOcrLines([line('Hello worlc')], new Map());
    const second = filterStableOcrLines([line('Hello world')], first.nextState);
    expect(second.stableLines).toHaveLength(1);
    expect(second.stableLines[0]?.text).toBe('Hello world');
  });

  it('resets when text changes materially at the same slot', () => {
    const first = filterStableOcrLines([line('Line A', 40)], new Map());
    const second = filterStableOcrLines([line('Line B', 42)], first.nextState);
    expect(second.stableLines.map((item) => item.text)).toEqual(['Line B']);
  });
});
