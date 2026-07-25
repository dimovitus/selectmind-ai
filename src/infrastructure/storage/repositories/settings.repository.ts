import type { ProviderConfig } from '@/domain/provider/provider.schema';
import type { ProviderId } from '@/domain/shared/ids';
import type { ProviderRepositoryPort, SettingsPort } from '@selectmind/core';
import type { Settings } from '@/shared/types/settings';
import { getExtensionPlatform } from '@/platform/extension';
import { ChromeSettingsAdapter } from '@/platform/extension/chrome-settings.adapter';
import { getDB } from '../indexeddb.adapter';

export type { ProviderRepositoryPort };

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

/** Facade over SettingsPort — keeps existing repository API for use-cases/RPC. */
export class SettingsRepository {
  constructor(private readonly settings: SettingsPort = getExtensionPlatform().settings) {}

  async get(): Promise<Settings> {
    return this.settings.get() as Promise<Settings>;
  }

  async update(partial: Partial<Settings>): Promise<Settings> {
    return this.settings.update(partial) as Promise<Settings>;
  }

  async pullFromSync(): Promise<void> {
    if (this.settings instanceof ChromeSettingsAdapter) {
      await this.settings.pullFromSync();
    }
  }
}
