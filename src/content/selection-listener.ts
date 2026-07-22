import { extractPageContext, rememberPageSelection } from './page-context-extractor';
import { getSelectionRect, type SelectionRect } from './selection-rect';

let selectionTimeout: ReturnType<typeof setTimeout> | null = null;

export type SelectionHandler = (
  context: ReturnType<typeof extractPageContext>,
  rect: SelectionRect,
) => void;

export type SelectionClearHandler = () => void;

let onSelection: SelectionHandler | null = null;
let onClear: SelectionClearHandler | null = null;

export function setSelectionHandler(handler: SelectionHandler | null): void {
  onSelection = handler;
}

export function setSelectionClearHandler(handler: SelectionClearHandler | null): void {
  onClear = handler;
}

export function initSelectionListener(): void {
  document.addEventListener('mouseup', handleSelectionChange);
  document.addEventListener('keyup', handleSelectionChange);
  document.addEventListener('selectionchange', handleSelectionChange);
}

export function destroySelectionListener(): void {
  document.removeEventListener('mouseup', handleSelectionChange);
  document.removeEventListener('keyup', handleSelectionChange);
  document.removeEventListener('selectionchange', handleSelectionChange);
}

function handleSelectionChange(): void {
  if (selectionTimeout) clearTimeout(selectionTimeout);

  selectionTimeout = setTimeout(() => {
    const text = window.getSelection()?.toString().trim() ?? '';

    if (text.length < 2) {
      onClear?.();
      return;
    }

    rememberPageSelection(text);

    const rect = getSelectionRect();
    if (!rect) return;

    const context = extractPageContext(text);
    onSelection?.(context, rect);
  }, 150);
}
