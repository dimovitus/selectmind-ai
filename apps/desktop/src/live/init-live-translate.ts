import {
  getHotkeyAccelerator,
  getHotkeyDefinition,
  LIVE_REGION_NEXT_HOTKEY_ID,
  LIVE_REGION_PREV_HOTKEY_ID,
} from '../settings/desktop-hotkeys';
import { getTauriHotkeyAdapter } from '../platform';
import { cycleLiveTranslateRegion } from './live-controller';
import { seedLiveTranslateSettingsIfNeeded } from './seed-live-settings';

export {
  getHotkeyAccelerator,
  getHotkeyDefinition,
  LIVE_TRANSLATE_HOTKEY_ID,
  LIVE_REGION_PREV_HOTKEY_ID,
  LIVE_REGION_NEXT_HOTKEY_ID,
} from '../settings/desktop-hotkeys';

export async function registerLiveTranslateHotkey(): Promise<void> {
  await seedLiveTranslateSettingsIfNeeded();

  const adapter = getTauriHotkeyAdapter();

  // Ctrl+Shift+L is registered in Rust (lib.rs) so it still works when the main
  // window is tucked off-screen or in the tray. Listen in Workspace.

  const prevDefinition = getHotkeyDefinition(LIVE_REGION_PREV_HOTKEY_ID);
  await adapter.register(
    {
      id: LIVE_REGION_PREV_HOTKEY_ID,
      accelerator: getHotkeyAccelerator(LIVE_REGION_PREV_HOTKEY_ID),
      description: prevDefinition.description,
    },
    () => {
      void cycleLiveTranslateRegion(-1);
    },
  );

  const nextDefinition = getHotkeyDefinition(LIVE_REGION_NEXT_HOTKEY_ID);
  await adapter.register(
    {
      id: LIVE_REGION_NEXT_HOTKEY_ID,
      accelerator: getHotkeyAccelerator(LIVE_REGION_NEXT_HOTKEY_ID),
      description: nextDefinition.description,
    },
    () => {
      void cycleLiveTranslateRegion(1);
    },
  );
}
