import type { ContextBundle } from '@/domain/conversation/conversation.schema';

export interface PageContext {
  selection: string;
  pageTitle: string;
  url: string;
  hostname: string;
  pageText?: string;
  language: string;
  date: string;
  time: string;
}

export function pageContextToBundle(ctx: PageContext): ContextBundle {
  return {
    selection: ctx.selection || undefined,
    pageTitle: ctx.pageTitle || undefined,
    url: ctx.url || undefined,
    hostname: ctx.hostname || undefined,
    pageText: ctx.pageText,
    language: ctx.language,
    date: ctx.date,
    time: ctx.time,
    customFragments: [],
  };
}

export function createEmptyPageContext(): PageContext {
  const now = new Date();
  return {
    selection: '',
    pageTitle: '',
    url: '',
    hostname: '',
    language: navigator.language,
    date: now.toLocaleDateString(),
    time: now.toLocaleTimeString(),
  };
}
