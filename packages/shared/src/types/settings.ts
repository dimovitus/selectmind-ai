import type { ActionId, ProviderId } from '@/domain/shared/ids';
import type { ResponseLanguageCode } from '@/shared/constants/response-languages';

export interface Settings {
  defaultProviderId: ProviderId | null;
  defaultModel: string | null;
  theme: 'dark' | 'light' | 'system';
  responseLanguage: ResponseLanguageCode;
  toolbarActionIds: ActionId[];
  maxToolbarActions: number;
  conversationRetentionDays: number;
  saveConversationHistory: boolean;
  showFloatingToolbar: boolean;
  enableStreaming: boolean;
  onboardingCompleted: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
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

export interface SyncSettings {
  theme: Settings['theme'];
  responseLanguage: ResponseLanguageCode;
  toolbarActionIds: ActionId[];
  showFloatingToolbar: boolean;
  enableStreaming: boolean;
}
