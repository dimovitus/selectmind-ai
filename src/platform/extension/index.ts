import type { PlatformPorts } from '@selectmind/core';
import { ChromeCaptureAdapter } from './chrome-capture.adapter';
import { ChromeHotkeyAdapter } from './chrome-hotkey.adapter';
import { ChromeOcrAdapter } from './chrome-ocr.adapter';
import { ChromePageContextAdapter } from './chrome-page-context.adapter';
import { ChromeSecretsAdapter } from './chrome-secrets.adapter';
import { ChromeSettingsAdapter } from './chrome-settings.adapter';

let extensionPlatform: PlatformPorts | null = null;

/** Singleton Chrome platform ports — wired into DI in a later Phase 0 step. */
export function createExtensionPlatform(): PlatformPorts {
  if (!extensionPlatform) {
    extensionPlatform = {
      secrets: new ChromeSecretsAdapter(),
      settings: new ChromeSettingsAdapter(),
      capture: new ChromeCaptureAdapter(),
      ocr: new ChromeOcrAdapter(),
      hotkeys: new ChromeHotkeyAdapter(),
      pageContext: new ChromePageContextAdapter(),
    };
  }
  return extensionPlatform;
}

export function getExtensionPlatform(): PlatformPorts {
  return createExtensionPlatform();
}

export function resetExtensionPlatform(): void {
  extensionPlatform = null;
}
