import type { ActionId, ProviderId } from '@/domain/shared/ids';
import type { ResponseLanguageCode } from '@/shared/constants/response-languages';

export interface Settings {
  defaultProviderId: ProviderId | null;
  defaultModel: string | null;
  theme: 'dark' | 'light' | 'system';
  responseLanguage: ResponseLanguageCode;
  toolbarActionIds: ActionId[];
  /** Action run by the OCR / screen-capture button and Ctrl+Shift+X. */
  screenshotActionId: ActionId;
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
  screenshotActionId: 'act_explain_screenshot' as ActionId,
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
  screenshotActionId: ActionId;
  showFloatingToolbar: boolean;
  enableStreaming: boolean;
}
