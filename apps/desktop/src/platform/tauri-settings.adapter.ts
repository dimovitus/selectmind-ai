import type { AppSettings, SettingsPort } from '@selectmind/core';
import { DEFAULT_SETTINGS } from '@selectmind/shared';
import { readJson, writeJson } from '../storage/local-store';

const SETTINGS_KEY = 'settings';

const FALLBACK_SETTINGS: AppSettings = {
  defaultProviderId: null,
  defaultModel: null,
  theme: 'dark',
  responseLanguage: 'auto',
  toolbarActionIds: [],
  maxToolbarActions: 7,
  conversationRetentionDays: 90,
  saveConversationHistory: true,
  showFloatingToolbar: true,
  enableStreaming: true,
  onboardingCompleted: false,
};

/** Desktop skeleton: settings in localStorage (Phase 1 → SQLite). */
export class TauriSettingsAdapter implements SettingsPort {
  async get(): Promise<AppSettings> {
    try {
      return { ...DEFAULT_SETTINGS, ...readJson<Partial<AppSettings>>(SETTINGS_KEY, {}) };
    } catch {
      return { ...FALLBACK_SETTINGS };
    }
  }

  async update(partial: Partial<AppSettings>): Promise<AppSettings> {
    const current = await this.get();
    const updated = { ...current, ...partial };
    writeJson(SETTINGS_KEY, updated);
    return updated;
  }
}
