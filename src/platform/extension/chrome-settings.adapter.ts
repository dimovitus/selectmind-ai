import type { AppSettings, SettingsPort } from '@selectmind/core';
import type { Settings, SyncSettings } from '@/shared/types/settings';
import { DEFAULT_SETTINGS } from '@/shared/types/settings';

const SETTINGS_KEY = 'saywa_settings';
const SYNC_KEY = 'saywa_sync';

/** Chrome extension: settings in chrome.storage.local + sync subset */
export class ChromeSettingsAdapter implements SettingsPort {
  async get(): Promise<AppSettings> {
    const result = await chrome.storage.local.get(SETTINGS_KEY);
    const stored = result[SETTINGS_KEY] as Settings | undefined;
    return { ...DEFAULT_SETTINGS, ...stored } as AppSettings;
  }

  async update(partial: Partial<AppSettings>): Promise<AppSettings> {
    const current = await this.get();
    const updated = { ...current, ...partial } as Settings;
    await chrome.storage.local.set({ [SETTINGS_KEY]: updated });
    await this.syncToCloud(updated);
    return updated as AppSettings;
  }

  /** Chrome sync — extension-only; not part of SettingsPort. */
  async pullFromSync(): Promise<void> {
    const result = await chrome.storage.sync.get(SYNC_KEY);
    const syncSettings = result[SYNC_KEY] as SyncSettings | undefined;
    if (syncSettings) {
      await this.update(syncSettings);
    }
  }

  private async syncToCloud(settings: Settings): Promise<void> {
    const syncPayload: SyncSettings = {
      theme: settings.theme,
      responseLanguage: settings.responseLanguage,
      toolbarActionIds: settings.toolbarActionIds,
      showFloatingToolbar: settings.showFloatingToolbar,
      enableStreaming: settings.enableStreaming,
    };
    await chrome.storage.sync.set({ [SYNC_KEY]: syncPayload });
  }
}
