import type { ProviderConfig } from '@/domain/provider/provider.schema';
import type { ProviderId } from '@/domain/shared/ids';
import type { Settings, SyncSettings } from '@/shared/types/settings';
import { DEFAULT_SETTINGS } from '@/shared/types/settings';
import { getDB } from '../indexeddb.adapter';

const SETTINGS_KEY = 'saywa_settings';
const SYNC_KEY = 'saywa_sync';

export interface ProviderRepositoryPort {
  getAll(): Promise<ProviderConfig[]>;
  getById(id: ProviderId): Promise<ProviderConfig | null>;
  save(provider: ProviderConfig): Promise<void>;
  delete(id: ProviderId): Promise<void>;
}

export class ProviderRepository implements ProviderRepositoryPort {
  async getAll(): Promise<ProviderConfig[]> {
    return getDB().providers.toArray();
  }

  async getById(id: ProviderId): Promise<ProviderConfig | null> {
    return (await getDB().providers.get(id)) ?? null;
  }

  async save(provider: ProviderConfig): Promise<void> {
    await getDB().providers.put(provider);
  }

  async delete(id: ProviderId): Promise<void> {
    await getDB().providers.delete(id);
  }
}

export class SettingsRepository {
  async get(): Promise<Settings> {
    const result = await chrome.storage.local.get(SETTINGS_KEY);
    const stored = result[SETTINGS_KEY] as Settings | undefined;
    return { ...DEFAULT_SETTINGS, ...stored };
  }

  async update(partial: Partial<Settings>): Promise<Settings> {
    const current = await this.get();
    const updated = { ...current, ...partial };
    await chrome.storage.local.set({ [SETTINGS_KEY]: updated });
    await this.syncToCloud(updated);
    return updated;
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

  async pullFromSync(): Promise<void> {
    const result = await chrome.storage.sync.get(SYNC_KEY);
    const syncSettings = result[SYNC_KEY] as SyncSettings | undefined;
    if (syncSettings) {
      await this.update(syncSettings);
    }
  }
}
