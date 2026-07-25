import type { ResponseLanguageCode } from '@/shared/constants/response-languages';

export type ActionLocale = Exclude<ResponseLanguageCode, 'auto'>;

const SUPPORTED_LOCALES: ActionLocale[] = [
  'en',
  'uk',
  'ru',
  'de',
  'fr',
  'es',
  'pl',
  'it',
  'pt',
  'ja',
  'zh',
];

function primaryLanguageTag(tag: string | undefined): string | null {
  if (!tag) return null;
  const primary = tag.split('-')[0]?.toLowerCase();
  return primary || null;
}

function toActionLocale(tag: string | undefined): ActionLocale | null {
  const primary = primaryLanguageTag(tag);
  if (!primary) return null;
  return SUPPORTED_LOCALES.includes(primary as ActionLocale) ? (primary as ActionLocale) : null;
}

function getChromeUiLanguage(): string | undefined {
  const g = globalThis as typeof globalThis & {
    chrome?: { i18n?: { getUILanguage?: () => string } };
  };
  return g.chrome?.i18n?.getUILanguage?.();
}

export function resolveActionLocale(
  responseLanguage: ResponseLanguageCode,
  languageHint?: string,
): ActionLocale {
  if (responseLanguage !== 'auto') {
    return responseLanguage;
  }

  const candidates = [
    languageHint,
    getChromeUiLanguage(),
    typeof navigator !== 'undefined' ? navigator.language : undefined,
  ];

  for (const candidate of candidates) {
    const locale = toActionLocale(candidate);
    if (locale) return locale;
  }

  return 'en';
}
