import { invoke } from '@tauri-apps/api/core';
import { rpcClient } from '@/infrastructure/messaging/rpc-client';

async function applySelectionMonitorSetting(): Promise<void> {
  const settings = await rpcClient.call('settings:get', undefined);
  await invoke('selection_set_monitor_enabled', { enabled: settings.showFloatingToolbar });
}

/** Sync the Rust background selection monitor with app settings. */
export function initSelectionMonitor(): () => void {
  void applySelectionMonitorSetting().catch((error) => {
    console.error('[selectmind] Failed to sync selection monitor setting:', error);
  });

  return () => {
    // Rust monitor lifetime follows the app process.
  };
}

export function syncSelectionMonitorSetting(): Promise<void> {
  return applySelectionMonitorSetting();
}

export {
  getHotkeyAccelerator,
  SELECTION_TOOLBAR_HOTKEY_ID,
} from '../settings/desktop-hotkeys';
