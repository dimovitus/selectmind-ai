import { emit } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import {
  getHotkeyAccelerator,
  PALETTE_HOTKEY_ID,
} from '../settings/desktop-hotkeys';

export { getHotkeyAccelerator, PALETTE_HOTKEY_ID } from '../settings/desktop-hotkeys';

/** @deprecated Use getHotkeyAccelerator(PALETTE_HOTKEY_ID) */
export const PALETTE_HOTKEY_ACCELERATOR = getHotkeyAccelerator(PALETTE_HOTKEY_ID);

async function showMainWindowAndRequestPalette(): Promise<void> {
  const mainWindow = getCurrentWindow();
  await mainWindow.show();
  await mainWindow.unminimize();
  await mainWindow.setFocus();
  await emit('desktop:palette-request');
}

export async function openDesktopCommandPalette(): Promise<void> {
  await showMainWindowAndRequestPalette();
}
