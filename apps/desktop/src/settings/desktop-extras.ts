import { readJson, writeJson } from '../storage/local-store';

const DESKTOP_EXTRAS_KEY = 'desktop-extras';

export type OcrEngine = 'auto' | 'tesseract' | 'windows';

export interface DesktopExtraSettings {
  launchAtStartup: boolean;
  /** When true, closing the window hides to tray instead of quitting. */
  closeToTray: boolean;
  /** When true, the minimize button hides to tray instead of the taskbar. */
  minimizeToTray: boolean;
  ocrEngine: OcrEngine;
  captureDisclaimerAccepted: boolean;
}

export const DEFAULT_DESKTOP_EXTRAS: DesktopExtraSettings = {
  launchAtStartup: false,
  closeToTray: true,
  minimizeToTray: true,
  ocrEngine: 'auto',
  captureDisclaimerAccepted: false,
};

export function readDesktopExtras(): DesktopExtraSettings {
  return {
    ...DEFAULT_DESKTOP_EXTRAS,
    ...readJson<Partial<DesktopExtraSettings>>(DESKTOP_EXTRAS_KEY, {}),
  };
}

export function writeDesktopExtras(partial: Partial<DesktopExtraSettings>): DesktopExtraSettings {
  const updated = { ...readDesktopExtras(), ...partial };
  writeJson(DESKTOP_EXTRAS_KEY, updated);
  if (typeof partial.closeToTray === 'boolean') {
    void import('../shell/sync-close-to-tray').then(({ syncCloseToTrayPreference }) =>
      syncCloseToTrayPreference(),
    );
  }
  return updated;
}
