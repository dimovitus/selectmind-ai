import type { Window } from '@tauri-apps/api/window';
import { invoke } from '@tauri-apps/api/core';
import { readDesktopExtras } from '../settings/desktop-extras';
import { isTrayReady } from './init-system-tray';

/** Hide main window in the system tray (skip taskbar entry). */
export async function hideMainWindowToTray(window: Window): Promise<void> {
  if (!isTrayReady()) {
    await window.setSkipTaskbar(false);
    await window.minimize();
    return;
  }

  await window.setSkipTaskbar(true);
  await window.hide();
}

/** Restore main window from the system tray. */
export async function showMainWindowFromTray(window: Window): Promise<void> {
  await window.setSkipTaskbar(false);
  await window.show();
  await window.unminimize();
  await window.setFocus();
}

export function shouldCloseToTray(): boolean {
  return readDesktopExtras().closeToTray;
}

export function shouldMinimizeToTray(): boolean {
  return readDesktopExtras().minimizeToTray;
}

export async function quitDesktopApp(): Promise<void> {
  await invoke('app_exit');
}
