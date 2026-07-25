import type { ResponseLanguageCode } from '../types/settings';

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

export type { ResponseLanguageCode };
