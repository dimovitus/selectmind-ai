import { invoke } from '@tauri-apps/api/core';
import { readDesktopExtras } from '../settings/desktop-extras';

export async function syncCloseToTrayPreference(): Promise<void> {
  try {
    await invoke('set_close_to_tray', { enabled: readDesktopExtras().closeToTray });
  } catch {
    // Desktop shell only — ignore in tests/web.
  }
}
