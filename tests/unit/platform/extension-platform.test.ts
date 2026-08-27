import { describe, expect, it } from 'vitest';
import { createExtensionPlatform, resetExtensionPlatform } from '@/platform/extension';

describe('extension platform adapters', () => {
  it('creates a full PlatformPorts bundle', () => {
    resetExtensionPlatform();
    const platform = createExtensionPlatform();

    expect(platform.secrets.storeApiKey).toBeTypeOf('function');
    expect(platform.settings.get).toBeTypeOf('function');
    expect(platform.capture.captureVisibleSurface).toBeTypeOf('function');
    expect(platform.ocr.recognizeText).toBeTypeOf('function');
    expect(platform.pageContext.extractCurrentContext).toBeTypeOf('function');
  });
});
