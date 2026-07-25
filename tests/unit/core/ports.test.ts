import { describe, expect, it } from 'vitest';
import type { PlatformPorts } from '@selectmind/core';

describe('@selectmind/core ports', () => {
  it('exports PlatformPorts shape for compile-time contracts', () => {
    const stub: PlatformPorts = {
      secrets: {
        storeApiKey: async () => {},
        getApiKey: async () => null,
        deleteApiKey: async () => {},
        hasApiKey: async () => false,
      },
      settings: {
        get: async () => ({
          defaultProviderId: null,
          defaultModel: null,
          theme: 'dark',
          responseLanguage: 'auto',
          toolbarActionIds: [],
          maxToolbarActions: 7,
          conversationRetentionDays: 90,
          saveConversationHistory: true,
          showFloatingToolbar: true,
          enableStreaming: true,
          onboardingCompleted: false,
        }),
        update: async (partial) => ({
          defaultProviderId: null,
          defaultModel: null,
          theme: 'dark',
          responseLanguage: 'auto',
          toolbarActionIds: [],
          maxToolbarActions: 7,
          conversationRetentionDays: 90,
          saveConversationHistory: true,
          showFloatingToolbar: true,
          enableStreaming: true,
          onboardingCompleted: false,
          ...partial,
        }),
      },
      capture: {
        captureVisibleSurface: async () => 'data:image/png;base64,',
      },
      ocr: {
        recognizeText: async () => '',
      },
      hotkeys: {
        register: async () => {},
        unregister: async () => {},
      },
      pageContext: {
        extractCurrentContext: () => ({
          selection: '',
          pageTitle: '',
          url: '',
          hostname: '',
          language: 'en',
          date: '',
          time: '',
        }),
      },
    };

    expect(stub.capture.captureVisibleSurface).toBeTypeOf('function');
  });
});
