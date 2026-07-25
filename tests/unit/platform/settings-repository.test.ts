import { describe, expect, it, vi } from 'vitest';
import type { AppSettings, SettingsPort } from '@selectmind/core';
import { SettingsRepository } from '@/infrastructure/storage/repositories/settings.repository';

const baseSettings: AppSettings = {
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

describe('SettingsRepository', () => {
  it('delegates get and update to SettingsPort', async () => {
    const settingsPort: SettingsPort = {
      get: vi.fn(async () => ({ ...baseSettings, theme: 'light' as const })),
      update: vi.fn(async (partial) => ({ ...baseSettings, ...partial })),
    };

    const repo = new SettingsRepository(settingsPort);

    await expect(repo.get()).resolves.toMatchObject({ theme: 'light' });
    await expect(repo.update({ showFloatingToolbar: false })).resolves.toMatchObject({
      showFloatingToolbar: false,
    });

    expect(settingsPort.get).toHaveBeenCalledOnce();
    expect(settingsPort.update).toHaveBeenCalledWith({ showFloatingToolbar: false });
  });
});
