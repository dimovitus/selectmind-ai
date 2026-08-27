import type { PlatformPorts } from '@selectmind/core';
import { TauriCaptureAdapter } from './tauri-capture.adapter';
import { TauriHotkeyAdapter } from './tauri-hotkey.adapter';
import { TauriOcrAdapter } from './tauri-ocr.adapter';
import { TauriPageContextAdapter } from './tauri-page-context.adapter';
import { TauriSecretsAdapter } from './tauri-secrets.adapter';
import { TauriSettingsAdapter } from './tauri-settings.adapter';

let desktopPlatform: PlatformPorts | null = null;
let hotkeyAdapter: TauriHotkeyAdapter | null = null;

export interface TauriPlatformBundle {
  platform: PlatformPorts;
  hotkeys: TauriHotkeyAdapter;
}

export function createTauriPlatform(): PlatformPorts {
  if (!desktopPlatform) {
    hotkeyAdapter = new TauriHotkeyAdapter();
    desktopPlatform = {
      secrets: new TauriSecretsAdapter(),
      settings: new TauriSettingsAdapter(),
      capture: new TauriCaptureAdapter(),
      ocr: new TauriOcrAdapter(),
      hotkeys: hotkeyAdapter,
      pageContext: new TauriPageContextAdapter(),
    };
  }
  return desktopPlatform;
}

export function getTauriHotkeyAdapter(): TauriHotkeyAdapter {
  createTauriPlatform();
  return hotkeyAdapter!;
}

export function resetTauriPlatform(): void {
  desktopPlatform = null;
  hotkeyAdapter = null;
}

export { TauriStreamEventsAdapter } from './tauri-stream-events.adapter';
export { TauriCaptureAdapter } from './tauri-capture.adapter';
