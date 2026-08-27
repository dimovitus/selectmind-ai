import { describe, expect, it } from 'vitest';
import { centerGrownBox, fitOverlayText, inflateCoverBox } from './live-overlay-fit';

/** Rough Inter metrics: ~0.5em per character at font-size 100px. */
function widthAt100(text: string): number {
  return text.length * 50;
}

function fit(text: string, boxWidth: number, boxHeight: number, maxWidth = 1920) {
  return fitOverlayText({
    text,
    boxWidth,
    boxHeight,
    widthAt100: widthAt100(text),
    fontScale: 1,
    maxFontPx: 36,
    maxWidth,
  });
}

describe('fitOverlayText', () => {
  it('uses the box height when the translation already fits', () => {
    const result = fit('НАЧАТЬ', 220, 30);
    expect(result.fontSize).toBe(24);
    expect(result.width).toBe(220);
    expect(result.wrap).toBe(false);
  });

  it('shrinks the font so a longer translation stays inside the box', () => {
    const result = fit('ФАЙЛ СОХРАНЕНИЯ', 120, 30);
    expect(result.fontSize).toBeLessThan(24);
    expect(result.width).toBe(120);
    expect(widthAt100('ФАЙЛ СОХРАНЕНИЯ') / 100).toBeGreaterThan(0);
    expect((widthAt100('ФАЙЛ СОХРАНЕНИЯ') / 100) * result.fontSize).toBeLessThanOrEqual(120);
  });

  it('wraps onto two lines when the box is tall enough', () => {
    const result = fit('Очень длинная строка перевода интерфейса', 200, 64);
    expect(result.wrap).toBe(true);
    expect(result.width).toBe(200);
  });

  it('widens the box only when the smallest readable font still overflows', () => {
    const result = fit('Совершенно невероятно длинное предложение интерфейса', 90, 18);
    expect(result.fontSize).toBeGreaterThanOrEqual(10);
    expect(result.width).toBeGreaterThan(90);
    expect(result.width).toBeLessThanOrEqual(Math.round(90 * 1.6));
  });

  it('never grows past the available screen width', () => {
    const result = fit('Совершенно невероятно длинное предложение интерфейса', 90, 18, 100);
    expect(result.width).toBeLessThanOrEqual(100);
  });

  it('falls back to the minimum font when measurement is unavailable', () => {
    const result = fitOverlayText({
      text: 'x',
      boxWidth: 50,
      boxHeight: 20,
      widthAt100: 0,
      fontScale: 1,
      maxFontPx: 36,
      maxWidth: 500,
    });
    expect(result.fontSize).toBe(10);
  });
});

describe('inflateCoverBox', () => {
  it('pads the OCR box so the original glyphs stay covered', () => {
    const box = inflateCoverBox(
      { left: 100, top: 200, width: 80, height: 20 },
      { width: 1920, height: 1080 },
    );
    expect(box.left).toBeLessThan(100);
    expect(box.top).toBeLessThan(200);
    expect(box.width).toBeGreaterThan(80);
    expect(box.height).toBeGreaterThan(20);
  });

  it('clamps to the viewport edges', () => {
    const box = inflateCoverBox(
      { left: 0, top: 0, width: 40, height: 40 },
      { width: 50, height: 50 },
    );
    expect(box.left).toBe(0);
    expect(box.top).toBe(0);
    expect(box.width).toBeLessThanOrEqual(50);
    expect(box.height).toBeLessThanOrEqual(50);
  });
});

describe('centerGrownBox', () => {
  it('keeps the original position when the box did not grow', () => {
    expect(centerGrownBox(300, 120, 120, 1920)).toBe(300);
  });

  it('centres growth on the original text', () => {
    expect(centerGrownBox(300, 120, 160, 1920)).toBe(280);
  });

  it('never pushes the box off screen', () => {
    expect(centerGrownBox(10, 100, 200, 1920)).toBe(0);
    expect(centerGrownBox(1800, 100, 200, 1920)).toBe(1720);
  });
});
