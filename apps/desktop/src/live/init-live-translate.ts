import {
  getHotkeyAccelerator,
  getHotkeyDefinition,
  LIVE_REGION_NEXT_HOTKEY_ID,
  LIVE_REGION_PREV_HOTKEY_ID,
  LIVE_TRANSLATE_HOTKEY_ID,
} from '../settings/desktop-hotkeys';
import { getTauriHotkeyAdapter } from '../platform';
import {
  cycleLiveTranslateRegion,
  toggleLiveTranslate,
} from './live-controller';

export {
  getHotkeyAccelerator,
  getHotkeyDefinition,
  LIVE_TRANSLATE_HOTKEY_ID,
  LIVE_REGION_PREV_HOTKEY_ID,
  LIVE_REGION_NEXT_HOTKEY_ID,
} from '../settings/desktop-hotkeys';

export async function registerLiveTranslateHotkey(): Promise<void> {
  const adapter = getTauriHotkeyAdapter();

  const toggleDefinition = getHotkeyDefinition(LIVE_TRANSLATE_HOTKEY_ID);
  await adapter.register(
    {
      id: LIVE_TRANSLATE_HOTKEY_ID,
      accelerator: getHotkeyAccelerator(LIVE_TRANSLATE_HOTKEY_ID),
      description: toggleDefinition.description,
    },
    () => {
      void toggleLiveTranslate(false);
    },
  );

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

export async function initLiveTranslateHotkey(): Promise<void> {
  await registerLiveTranslateHotkey();
}
