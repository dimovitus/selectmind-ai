import type { PageContext } from '@/shared/types/page-context';
import type { SelectionSnapshot } from './types';

export function buildSelectionPageContext(snapshot: SelectionSnapshot): PageContext {
  const now = new Date();
  return {
    selection: snapshot.text,
    pageTitle: snapshot.windowTitle || 'Desktop selection',
    url: '',
    hostname: '',
    language: typeof navigator !== 'undefined' ? navigator.language : 'en',
    date: now.toLocaleDateString(),
    time: now.toLocaleTimeString(),
  };
}
