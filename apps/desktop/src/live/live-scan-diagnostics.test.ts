import { describe, expect, it } from 'vitest';
import {
  BLANK_FRAME_LUMA,
  BLANK_FRAME_RANGE,
  buildTickStatus,
  describeEmptyScan,
  isBlankFrame,
  shortenError,
} from './live-scan-diagnostics';

describe('isBlankFrame', () => {
  it('detects uniform near-black captures', () => {
    expect(isBlankFrame({ meanLuma: BLANK_FRAME_LUMA, lumaRange: BLANK_FRAME_RANGE })).toBe(true);
    expect(isBlankFrame({ meanLuma: 0, lumaRange: 0 })).toBe(true);
  });

  it('keeps dark but non-uniform game frames', () => {
    expect(isBlankFrame({ meanLuma: 3, lumaRange: 40 })).toBe(false);
  });
});

describe('describeEmptyScan', () => {
  it('explains blank capture vs missing OCR text', () => {
    expect(
      describeEmptyScan({ width: 1920, height: 1080, meanLuma: 0, lumaRange: 0, ocrLanguage: 'en' }),
    ).toContain('Capture is blank');
    expect(describeEmptyScan({ width: 800, height: 200, meanLuma: 90, lumaRange: 50, ocrLanguage: 'en' })).toContain(
      'No text found',
    );
  });
});

describe('buildTickStatus', () => {
  it('shows OCR language, line count, and engine badge', () => {
    expect(buildTickStatus({ ocrLanguage: 'en' }, 3, 'bing-free', null, 'info')).toBe(
      'en · 3 lines · Bing',
    );
  });

  it('prefers explicit messages and hides status on warn with zero lines', () => {
    expect(buildTickStatus({ ocrLanguage: 'en' }, 0, 'bing-free', 'Rate limited', 'warn')).toBe(
      'Rate limited',
    );
    expect(buildTickStatus({ ocrLanguage: 'en' }, 0, 'bing-free', null, 'warn')).toBeNull();
  });
});

describe('shortenError', () => {
  it('trims and caps long messages', () => {
    expect(shortenError('  hello   world  ')).toBe('hello world');
    expect(shortenError('x'.repeat(120), 20)).toHaveLength(20);
    expect(shortenError('x'.repeat(120), 20).endsWith('…')).toBe(true);
  });
});
