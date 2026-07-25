import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { createTauriPlatform } from '../platform';
import type { SelectionSnapshot } from '../selection/types';
import { focusCaptureWindow, formatUnknownError } from './capture-utils';
import {
  completeScreenCaptureFromRegion,
} from './run-desktop-capture-flow';
import { isRegionPickerActive, requestRegionSelection, type RegionPickerResult } from './region-picker-store';
import {
  getHotkeyAccelerator,
  OCR_TOOLBAR_HOTKEY_ID,
} from '../settings/desktop-hotkeys';

export {
  getHotkeyAccelerator,
  OCR_TOOLBAR_HOTKEY_ID,
} from '../settings/desktop-hotkeys';

/** @deprecated Use getHotkeyAccelerator(OCR_TOOLBAR_HOTKEY_ID) */
export const OCR_TOOLBAR_HOTKEY_ACCELERATOR = getHotkeyAccelerator(OCR_TOOLBAR_HOTKEY_ID);

let ocrToolbarInProgress = false;

export type OcrToolbarErrorHandler = (message: string) => void;

function regionToSnapshot(picked: RegionPickerResult, text: string): SelectionSnapshot {
  const scale = picked.devicePixelRatio || picked.monitor.scaleFactor || 1;
  return {
    text,
    x: picked.monitor.x + Math.round(picked.region.x * scale),
    y: picked.monitor.y + Math.round(picked.region.y * scale),
    width: Math.max(Math.round(picked.region.width * scale), 1),
    height: Math.max(Math.round(picked.region.height * scale), 1),
    windowTitle: 'Screen OCR',
  };
}

/** Pick a screen region, OCR it, and show the floating toolbar (translate, explain, …). */
export async function runDesktopOcrToolbarFlow(
  onError?: OcrToolbarErrorHandler,
): Promise<boolean> {
  if (ocrToolbarInProgress || isRegionPickerActive()) return false;
  ocrToolbarInProgress = true;

  const platform = createTauriPlatform();
  let mainWasHidden = false;
  let restoreMainOnExit = true;

  try {
    const sourceWindowId = await invoke<number>('selection_foreground_window_id');

    const picked = await requestRegionSelection();
    mainWasHidden = true;
    if (!picked) return false;

    const screenshot = await completeScreenCaptureFromRegion(picked, platform);
    const text = screenshot.ocrText?.trim();
    if (!text) {
      throw new Error('No text recognized in the selected area. Try a larger region.');
    }

    const snapshot = regionToSnapshot(picked, text);
    await invoke('selection_show_toolbar', {
      args: {
        snapshot,
        sourceWindowId,
      },
    });

    // Keep the workspace hidden — toolbar floats over the target app.
    try {
      const main = getCurrentWindow();
      if (main.label === 'main') {
        await main.setSkipTaskbar(true);
        await main.hide();
      }
    } catch {
      // Non-fatal if the window is already hidden.
    }

    // Toolbar is shown over the target app — keep the main window hidden.
    restoreMainOnExit = false;
    return true;
  } catch (error) {
    const message = formatUnknownError(error, 'OCR toolbar failed');
    onError?.(message);
    return false;
  } finally {
    if (mainWasHidden && restoreMainOnExit) {
      await focusCaptureWindow();
    }
    ocrToolbarInProgress = false;
  }
}

export function isOcrToolbarBusy(): boolean {
  return ocrToolbarInProgress;
}
