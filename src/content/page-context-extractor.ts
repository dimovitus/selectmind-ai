import type { PageContext } from '@/shared/types/page-context';
import { createEmptyPageContext } from '@/shared/types/page-context';

const MAX_PAGE_TEXT_LENGTH = 8000;

let lastSelectionText = '';

/** Keep the latest non-empty page selection for popup actions. */
export function rememberPageSelection(text: string): void {
  const trimmed = text.trim();
  if (trimmed.length > 0) {
    lastSelectionText = trimmed;
  }
}

export function getRememberedSelection(): string {
  return lastSelectionText;
}

export function extractPageContext(selection?: string): PageContext {
  const now = new Date();
  const ctx = createEmptyPageContext();

  ctx.selection = ((selection ?? getSelectionText()) || lastSelectionText).trim();
  ctx.pageTitle = document.title;
  ctx.url = window.location.href;
  ctx.hostname = window.location.hostname;
  ctx.date = now.toLocaleDateString();
  ctx.time = now.toLocaleTimeString();
  ctx.pageText = extractPageText();

  return ctx;
}

function getSelectionText(): string {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed) return '';
  return selection.toString().trim();
}

function extractPageText(): string {
  const clone = document.body.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('script, style, noscript, nav, footer, iframe').forEach((el) => {
    el.remove();
  });
  const text = clone.innerText.replace(/\s+/g, ' ').trim();
  return text.slice(0, MAX_PAGE_TEXT_LENGTH);
}

export { getSelectionRect, captureRect, type SelectionRect } from './selection-rect';
