import { describe, expect, it, vi } from 'vitest';
import type { PlatformPorts } from '@selectmind/core';
import { completeScreenCaptureFromRegion } from '@/content/screen-capture/run-capture-flow';

function createMockPlatform(overrides?: Partial<PlatformPorts>): PlatformPorts {
  return {
    secrets: {
      storeApiKey: vi.fn(),
      getApiKey: vi.fn(),
      deleteApiKey: vi.fn(),
      hasApiKey: vi.fn(),
    },
    settings: {
      get: vi.fn(),
      update: vi.fn(),
    },
    capture: {
      captureVisibleSurface: vi.fn(async () => 'data:image/jpeg;base64,tab'),
      cropImage: vi.fn(async () => 'data:image/jpeg;base64,cropped'),
    },
    ocr: {
      recognizeText: vi.fn(async () => '  hello ocr  '),
    },
    hotkeys: {
      register: vi.fn(),
      unregister: vi.fn(),
    },
    pageContext: {
      extractCurrentContext: vi.fn(() => ({
        selection: '',
        pageTitle: 'Test',
        url: 'https://example.com',
        hostname: 'example.com',
        language: 'en',
        date: '1/1/2025',
        time: '12:00',
      })),
    },
    ...overrides,
  };
}

describe('completeScreenCaptureFromRegion', () => {
  it('uses capture and ocr ports in order', async () => {
    const platform = createMockPlatform();
    const picked = {
      region: { x: 10, y: 20, width: 100, height: 50 },
      devicePixelRatio: 2,
    };

    const result = await completeScreenCaptureFromRegion(picked, platform);

    expect(platform.capture.captureVisibleSurface).toHaveBeenCalledOnce();
    expect(platform.capture.cropImage).toHaveBeenCalledWith(
      'data:image/jpeg;base64,tab',
      picked.region,
      2,
    );
    expect(platform.ocr.recognizeText).toHaveBeenCalledWith('data:image/jpeg;base64,cropped', {
      languages: ['eng', 'rus'],
    });
    expect(result).toEqual({
      dataUrl: 'data:image/jpeg;base64,cropped',
      ocrText: 'hello ocr',
      width: 100,
      height: 50,
    });
  });

  it('omits ocrText when OCR returns whitespace only', async () => {
    const platform = createMockPlatform({
      ocr: { recognizeText: vi.fn(async () => '   ') },
    });

    const result = await completeScreenCaptureFromRegion(
      { region: { x: 0, y: 0, width: 10, height: 10 }, devicePixelRatio: 1 },
      platform,
    );

    expect(result.ocrText).toBeUndefined();
  });
});
