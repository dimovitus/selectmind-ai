import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import {
  hideMainWindowToTray,
  quitDesktopApp,
  shouldCloseToTray,
  shouldMinimizeToTray,
} from './tray-window';

let trayInitialized = false;

export function isTrayReady(): boolean {
  return trayInitialized;
}

async function registerWindowTrayBehavior(mainWindow: ReturnType<typeof getCurrentWindow>): Promise<void> {
  await mainWindow.onCloseRequested(async (event) => {
    if (shouldCloseToTray()) {
      event.preventDefault();
      await hideMainWindowToTray(mainWindow);
      return;
    }
    await quitDesktopApp();
  });

  await mainWindow.onResized(async () => {
    if (!shouldMinimizeToTray()) return;
    if (!(await mainWindow.isMinimized())) return;
    await hideMainWindowToTray(mainWindow);
    await mainWindow.unminimize();
  });
}

export async function initDesktopSystemTray(): Promise<void> {
  if (trayInitialized) return;

  const mainWindow = getCurrentWindow();
  await registerWindowTrayBehavior(mainWindow);

  trayInitialized = await invoke<boolean>('tray_is_ready');
  if (!trayInitialized) {
    console.error(
      '[selectmind] System tray is unavailable — minimize/close will use the taskbar instead.',
    );
  }
}

export function listenDesktopCaptureRequests(onCapture: () => void): () => void {
  let unlisten: (() => void) | undefined;

  void listen('desktop:capture-request', () => {
    onCapture();
  }).then((dispose) => {
    unlisten = dispose;
  });

  return () => {
    unlisten?.();
  };
}

export function listenDesktopOcrToolbarRequests(onOcrToolbar: () => void): () => void {
  let unlisten: (() => void) | undefined;

  void listen('desktop:ocr-toolbar-request', () => {
    onOcrToolbar();
  }).then((dispose) => {
    unlisten = dispose;
  });

  return () => {
    unlisten?.();
  };
}
