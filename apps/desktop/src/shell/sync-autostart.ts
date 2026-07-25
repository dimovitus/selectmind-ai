import { disable, enable, isEnabled } from '@tauri-apps/plugin-autostart';
import {
  readDesktopExtras,
  writeDesktopExtras,
  type DesktopExtraSettings,
} from '../settings/desktop-extras';

export async function syncAutostartSetting(
  shouldEnable = readDesktopExtras().launchAtStartup,
): Promise<void> {
  const enabled = await isEnabled();
  if (shouldEnable && !enabled) {
    await enable();
  } else if (!shouldEnable && enabled) {
    await disable();
  }
}

export async function setLaunchAtStartup(enabled: boolean): Promise<DesktopExtraSettings> {
  const updated = writeDesktopExtras({ launchAtStartup: enabled });
  await syncAutostartSetting(enabled);
  return updated;
}

export async function initDesktopAutostart(): Promise<void> {
  await syncAutostartSetting(readDesktopExtras().launchAtStartup);
}
