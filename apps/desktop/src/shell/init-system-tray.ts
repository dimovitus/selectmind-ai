import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { isLiveTranslateActive } from '../live/live-controller';
import {
  hideMainWindowToTray,
  quitDesktopApp,
  shouldCloseToTray,
  shouldMinimizeToTray,
} from './tray-window';
import { syncCloseToTrayPreference } from './sync-close-to-tray';

let trayHandlersRegistered = false;
let trayAvailable = false;

export function isTrayReady(): boolean {
  return trayAvailable;
}

async function registerWindowTrayBehavior(mainWindow: ReturnType<typeof getCurrentWindow>): Promise<void> {
  if (trayHandlersRegistered) return;
  trayHandlersRegistered = true;

  await mainWindow.onCloseRequested(async (event) => {
    if (isLiveTranslateActive()) {
      event.preventDefault();
      const { stopLiveTranslate } = await import('../live/live-controller');
      await stopLiveTranslate();
    }

    if (shouldCloseToTray()) {
      event.preventDefault();
      await hideMainWindowToTray(mainWindow);
      return;
    }

    await quitDesktopApp();
  });

  await mainWindow.onResized(async () => {
    if (isLiveTranslateActive()) return;
    if (!shouldMinimizeToTray()) return;
    if (!(await mainWindow.isMinimized())) return;
    await hideMainWindowToTray(mainWindow);
    await mainWindow.unminimize();
  });
}

export async function initDesktopSystemTray(): Promise<void> {
  await syncCloseToTrayPreference();

  const mainWindow = getCurrentWindow();
  await registerWindowTrayBehavior(mainWindow);

  trayAvailable = await invoke<boolean>('tray_is_ready');
  if (!trayAvailable) {
    console.error(
      '[selectmind] System tray is unavailable — minimize/close will use the taskbar instead.',
    );
  }
}
