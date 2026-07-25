import type { CapturePort } from './capture.port';
import type { HotkeyPort } from './hotkey.port';
import type { OcrPort } from './ocr.port';
import type { PageContextPort } from './page-context.port';
import type { SecretsPort } from './secrets.port';
import type { SettingsPort } from './settings.port';

/** All platform-specific capabilities injected into the app. */
export interface PlatformPorts {
  secrets: SecretsPort;
  settings: SettingsPort;
  capture: CapturePort;
  ocr: OcrPort;
  hotkeys: HotkeyPort;
  pageContext: PageContextPort;
}
