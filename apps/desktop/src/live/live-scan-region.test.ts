import { describe, expect, it } from 'vitest';
import { resolveLiveOcrLanguageTag, resolveOcrLanguageTag } from './live-ocr-language';
import { offsetOcrLines, resolveScanRegion } from './live-scan-region';
import { isLikelyOverlayEcho } from './live-stability';
import type { LiveRegion } from './types';

const fullScreen: LiveRegion = {
  monitorX: 0,
  monitorY: 0,
  x: 0,
  y: 0,
  width: 1920,
  height: 1080,
  scaleFactor: 1,
};

describe('resolveOcrLanguageTag', () => {
  it('maps auto to undefined for Windows OCR fallback', () => {
    expect(resolveOcrLanguageTag('auto')).toBeUndefined();
    expect(resolveOcrLanguageTag('  ')).toBeUndefined();
  });

  it('passes through BCP-47 tags', () => {
    expect(resolveOcrLanguageTag('en')).toBe('en');
    expect(resolveOcrLanguageTag(' JA ')).toBe('ja');
  });
});

describe('resolveLiveOcrLanguageTag', () => {
  it('defaults auto+auto to eng for English game UI', () => {
    expect(resolveLiveOcrLanguageTag('auto', 'auto')).toBe('en');
  });

  it('follows source language when OCR is auto', () => {
    expect(resolveLiveOcrLanguageTag('auto', 'en')).toBe('en');
    expect(resolveLiveOcrLanguageTag('auto', 'ja-JP')).toBe('ja');
  });

  it('honours explicit OCR language over source', () => {
    expect(resolveLiveOcrLanguageTag('ru', 'en')).toBe('ru');
  });
});

describe('resolveScanRegion', () => {
  it('uses dialogue band for full-screen continuous', () => {
    const { region, yOffsetPhysical } = resolveScanRegion(fullScreen, {
      coverage: 'screen',
      scanFocus: 'dialogue-band',
    });
    expect(region.height).toBe(Math.floor(1080 * 0.42));
    expect(region.y).toBe(1080 - region.height);
    expect(yOffsetPhysical).toBe(region.y);
  });

  it('uses top band for menu-heavy games', () => {
    const { region, yOffsetPhysical } = resolveScanRegion(fullScreen, {
      coverage: 'screen',
      scanFocus: 'top-band',
    });
    expect(region.height).toBe(Math.floor(1080 * 0.35));
    expect(region.y).toBe(0);
    expect(yOffsetPhysical).toBe(0);
  });

  it('keeps full region for hand-picked areas', () => {
    const strip: LiveRegion = { ...fullScreen, y: 900, height: 120 };
    const { region, yOffsetPhysical } = resolveScanRegion(strip, {
      coverage: 'region',
      scanFocus: 'dialogue-band',
    });
    expect(region).toEqual(strip);
    expect(yOffsetPhysical).toBe(0);
  });
});

describe('offsetOcrLines', () => {
  it('shifts OCR boxes back into full-screen coordinates', () => {
    const offset = offsetOcrLines([{ text: 'Hi', x: 10, y: 5, width: 40, height: 12 }], 600);
    expect(offset[0]?.y).toBe(605);
  });
});

describe('isLikelyOverlayEcho', () => {
  it('matches identical overlay output but not short game words', () => {
    expect(isLikelyOverlayEcho('Press start to continue', 'Press start to continue')).toBe(true);
    expect(isLikelyOverlayEcho('OK', 'OK')).toBe(true);
    expect(isLikelyOverlayEcho('Welcome to the ruins of Eldoria', 'OK')).toBe(false);
  });
});
