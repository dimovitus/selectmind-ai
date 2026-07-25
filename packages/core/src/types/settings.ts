/** Branded IDs — will align with domain ids when core absorbs domain layer. */
export type ProviderId = string & { readonly __brand: 'ProviderId' };
export type ActionId = string & { readonly __brand: 'ActionId' };

export type ThemeMode = 'dark' | 'light' | 'system';
export type ResponseLanguageCode =
  | 'auto'
  | 'en'
  | 'uk'
  | 'ru'
  | 'de'
  | 'fr'
  | 'es'
  | 'pl'
  | 'it'
  | 'pt'
  | 'ja'
  | 'zh';

/** App settings persisted outside IndexedDB (key-value / sync). */
export interface AppSettings {
  defaultProviderId: ProviderId | null;
  defaultModel: string | null;
  theme: ThemeMode;
  responseLanguage: ResponseLanguageCode;
  toolbarActionIds: ActionId[];
  maxToolbarActions: number;
  conversationRetentionDays: number;
  saveConversationHistory: boolean;
  showFloatingToolbar: boolean;
  enableStreaming: boolean;
  onboardingCompleted: boolean;
}
