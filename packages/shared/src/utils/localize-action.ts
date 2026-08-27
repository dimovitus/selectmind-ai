import type { Action } from '@/domain/action/action.schema';
import { getLocalizedActionText } from '@/shared/constants/localized-built-in-actions';

export function localizeAction(
  action: Action,
  responseLanguage: Parameters<typeof getLocalizedActionText>[1],
  languageHint?: string,
): Action {
  if (!action.isBuiltIn) return action;

  const localized = getLocalizedActionText(action.id, responseLanguage, languageHint, {
    name: action.name,
    prompt: action.prompt,
  });

  if (!localized) return action;

  return {
    ...action,
    name: localized.name,
    prompt: localized.prompt,
  };
}

export function localizeActions(
  actions: Action[],
  responseLanguage: Parameters<typeof getLocalizedActionText>[1],
  languageHint?: string,
): Action[] {
  return actions.map((action) => localizeAction(action, responseLanguage, languageHint));
}
