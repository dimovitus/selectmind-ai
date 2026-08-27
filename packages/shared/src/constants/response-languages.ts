export const RESPONSE_LANGUAGE_OPTIONS = [
  { code: 'auto', label: 'Auto (match selection)' },
  { code: 'en', label: 'English' },
  { code: 'uk', label: 'Ukrainian' },
  { code: 'ru', label: 'Russian' },
  { code: 'de', label: 'German' },
  { code: 'fr', label: 'French' },
  { code: 'es', label: 'Spanish' },
  { code: 'pl', label: 'Polish' },
  { code: 'it', label: 'Italian' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'ja', label: 'Japanese' },
  { code: 'zh', label: 'Chinese' },
] as const;

export type ResponseLanguageCode = (typeof RESPONSE_LANGUAGE_OPTIONS)[number]['code'];

const LANGUAGE_NAMES: Record<Exclude<ResponseLanguageCode, 'auto'>, string> = {
  en: 'English',
  uk: 'Ukrainian',
  ru: 'Russian',
  de: 'German',
  fr: 'French',
  es: 'Spanish',
  pl: 'Polish',
  it: 'Italian',
  pt: 'Portuguese',
  ja: 'Japanese',
  zh: 'Chinese',
};

export function buildResponseLanguageInstruction(code: ResponseLanguageCode): string {
  if (code === 'auto') {
    return 'Respond in the same language as the selected text or user message. If the language is unclear, use the browser/page language from context.';
  }

  return `Always respond in ${LANGUAGE_NAMES[code]}.`;
}
