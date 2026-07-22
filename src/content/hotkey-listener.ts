import type { Action } from '@/domain/action/action.schema';
import type { PageContext } from '@/shared/types/page-context';
import { rpcClient } from '@/infrastructure/messaging/rpc-client';
import { matchesHotkey } from '@/shared/utils/hotkey';
import { extractPageContext } from './page-context-extractor';

type HotkeyHandler = (action: Action, context: PageContext) => void;

let actions: Action[] = [];
let onHotkey: HotkeyHandler | null = null;
let loaded = false;

export function setHotkeyHandler(handler: HotkeyHandler | null): void {
  onHotkey = handler;
}

async function loadActions(): Promise<void> {
  if (loaded) return;
  actions = await rpcClient.call('action:list', undefined);
  loaded = true;
}

export function reloadHotkeyActions(): void {
  loaded = false;
  void loadActions();
}

function isExtensionEditableTarget(event: KeyboardEvent): boolean {
  for (const node of event.composedPath()) {
    if (!(node instanceof HTMLElement)) continue;
    if (
      node.tagName === 'INPUT' ||
      node.tagName === 'TEXTAREA' ||
      node.isContentEditable
    ) {
      return true;
    }
    if (node.id === 'saywa-root' || node.id === 'saywa-app') {
      return true;
    }
  }
  return false;
}

function handleKeyDown(event: KeyboardEvent): void {
  if (!onHotkey) return;

  if (isExtensionEditableTarget(event)) return;

  for (const action of actions) {
    if (!action.isEnabled || !action.hotkey) continue;
    if (matchesHotkey(event, action.hotkey)) {
      event.preventDefault();
      event.stopPropagation();
      const context = extractPageContext();
      if (!context.selection.trim()) return;
      onHotkey(action, context);
      return;
    }
  }
}

export function initHotkeyListener(): void {
  void loadActions();
  document.addEventListener('keydown', handleKeyDown, true);
}

export function destroyHotkeyListener(): void {
  document.removeEventListener('keydown', handleKeyDown, true);
}
