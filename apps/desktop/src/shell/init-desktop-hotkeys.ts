import { invoke } from '@tauri-apps/api/core';
import { getTauriHotkeyAdapter } from '../platform';
import {
  getHotkeyAccelerator,
  getHotkeyDefinition,
  OCR_CAPTURE_HOTKEY_ID,
  OCR_TOOLBAR_HOTKEY_ID,
  PALETTE_HOTKEY_ID,
  SELECTION_TOOLBAR_HOTKEY_ID,
} from '../settings/desktop-hotkeys';

import { openDesktopCommandPalette } from './init-command-palette-hotkey';
import { registerLiveTranslateHotkey } from '../live/init-live-translate';

export interface DesktopHotkeyHandlers {
  onOcrCapture: () => void;
  onOcrToolbar: () => void;
}

let handlers: DesktopHotkeyHandlers | null = null;

export function setDesktopHotkeyHandlers(next: DesktopHotkeyHandlers): void {
  handlers = next;
}

export async function syncDesktopHotkeys(): Promise<void> {
  if (!handlers) return;

  const adapter = getTauriHotkeyAdapter();

  const ocrCapture = getHotkeyDefinition(OCR_CAPTURE_HOTKEY_ID);
  await adapter.register(
    {
      id: OCR_CAPTURE_HOTKEY_ID,
      accelerator: getHotkeyAccelerator(OCR_CAPTURE_HOTKEY_ID),
      description: ocrCapture.description,
    },
    handlers.onOcrCapture,
  );

  const ocrToolbar = getHotkeyDefinition(OCR_TOOLBAR_HOTKEY_ID);
  await adapter.register(
    {
      id: OCR_TOOLBAR_HOTKEY_ID,
      accelerator: getHotkeyAccelerator(OCR_TOOLBAR_HOTKEY_ID),
      description: ocrToolbar.description,
    },
    handlers.onOcrToolbar,
  );

  const palette = getHotkeyDefinition(PALETTE_HOTKEY_ID);
  await adapter.register(
    {
      id: PALETTE_HOTKEY_ID,
      accelerator: getHotkeyAccelerator(PALETTE_HOTKEY_ID),
      description: palette.description,
    },
    () => {
      void openDesktopCommandPalette();
    },
  );

  const selectionToolbar = getHotkeyDefinition(SELECTION_TOOLBAR_HOTKEY_ID);
  await adapter.register(
    {
      id: SELECTION_TOOLBAR_HOTKEY_ID,
      accelerator: getHotkeyAccelerator(SELECTION_TOOLBAR_HOTKEY_ID),
      description: selectionToolbar.description,
    },
    () => {
      void invoke('selection_trigger_manual_toolbar');
    },
  );

  await registerLiveTranslateHotkey();
}

export async function initDesktopHotkeys(next: DesktopHotkeyHandlers): Promise<void> {
  setDesktopHotkeyHandlers(next);
  await syncDesktopHotkeys();
}
