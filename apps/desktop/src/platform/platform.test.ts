import { describe, expect, it } from 'vitest';
import { createTauriPlatform, resetTauriPlatform } from './index';

describe('desktop platform adapters', () => {
  it('creates a full PlatformPorts bundle', () => {
    resetTauriPlatform();
    const platform = createTauriPlatform();

    expect(platform.secrets.storeApiKey).toBeTypeOf('function');
    expect(platform.settings.get).toBeTypeOf('function');
    expect(platform.capture.captureVisibleSurface).toBeTypeOf('function');
    expect(platform.ocr.recognizeText).toBeTypeOf('function');
    expect(platform.hotkeys.register).toBeTypeOf('function');
    expect(platform.pageContext.extractCurrentContext).toBeTypeOf('function');
  });
});
