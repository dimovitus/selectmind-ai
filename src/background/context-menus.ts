import type { Action } from '@/domain/action/action.schema';
import { getContainer } from '@/di/container';
import { ensureDatabaseSeeded } from './seed';
import { PRODUCT_NAME } from '@/shared/constants/brand';
import type { ActionId } from '@/domain/shared/ids';
import type { PageContext } from '@/shared/types/page-context';
import { localizeActions } from '@/shared/utils/localize-action';

const ROOT_MENU_ID = 'saywa-ctx-root';
const PALETTE_MENU_ID = 'saywa-ctx-palette';
const ACTION_PREFIX = 'saywa-ctx-action:';

function actionMenuId(actionId: ActionId): string {
  return `${ACTION_PREFIX}${actionId}`;
}

function parseActionMenuId(menuItemId: string): ActionId | null {
  if (!menuItemId.startsWith(ACTION_PREFIX)) return null;
  return menuItemId.slice(ACTION_PREFIX.length) as ActionId;
}

async function getToolbarActions(): Promise<Action[]> {
  await ensureDatabaseSeeded();
  const { actionRepo, settingsRepo } = getContainer();
  const settings = await settingsRepo.get();
  const allActions = await actionRepo.getAll();
  const actionMap = new Map(allActions.map((a) => [a.id, a]));

  if (settings.toolbarActionIds.length > 0) {
    const toolbar = settings.toolbarActionIds
      .map((id) => actionMap.get(id))
      .filter((a): a is Action => !!a && a.isEnabled);
    return localizeActions(toolbar, settings.responseLanguage);
  }

  const fallback = allActions.filter((a) => a.isEnabled).sort((a, b) => a.order - b.order);
  return localizeActions(fallback, settings.responseLanguage);
}

export async function rebuildContextMenus(): Promise<void> {
  const actions = await getToolbarActions();

  await new Promise<void>((resolve) => {
    chrome.contextMenus.removeAll(() => resolve());
  });

  chrome.contextMenus.create({
    id: ROOT_MENU_ID,
    title: PRODUCT_NAME,
    contexts: ['selection'],
  });

  for (const action of actions) {
    chrome.contextMenus.create({
      id: actionMenuId(action.id),
      parentId: ROOT_MENU_ID,
      title: `${action.icon} ${action.name}`,
      contexts: ['selection'],
    });
  }

  chrome.contextMenus.create({
    id: PALETTE_MENU_ID,
    parentId: ROOT_MENU_ID,
    title: 'Command Palette (Ctrl+Shift+P)',
    contexts: ['selection'],
  });
}

function buildPageContext(tab: chrome.tabs.Tab, selectionText: string): PageContext {
  const now = new Date();
  let hostname = '';

  if (tab.url) {
    try {
      hostname = new URL(tab.url).hostname;
    } catch {
      hostname = '';
    }
  }

  return {
    selection: selectionText.trim(),
    pageTitle: tab.title ?? '',
    url: tab.url ?? '',
    hostname,
    language: 'en',
    date: now.toLocaleDateString(),
    time: now.toLocaleTimeString(),
  };
}

async function runActionOnTab(tabId: number, actionId: ActionId, selectionText: string): Promise<void> {
  const tab = await chrome.tabs.get(tabId);
  const context = buildPageContext(tab, selectionText);

  await chrome.tabs.sendMessage(tabId, {
    type: 'saywa:context-menu-action',
    actionId,
    context,
  });
}

export function setupContextMenus(): void {
  void rebuildContextMenus();

  chrome.runtime.onInstalled.addListener(() => {
    void rebuildContextMenus();
  });

  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (!tab?.id) return;

    const selectionText = info.selectionText?.trim() ?? '';
    if (!selectionText) return;

    if (info.menuItemId === PALETTE_MENU_ID) {
      void chrome.tabs.sendMessage(tab.id, { type: 'saywa:open-palette' });
      return;
    }

    const actionId = parseActionMenuId(String(info.menuItemId));
    if (actionId) {
      void runActionOnTab(tab.id, actionId, selectionText).catch(() => {
        // Content script may not be injected on restricted pages (chrome://, etc.)
      });
    }
  });
}

export { rebuildContextMenus as refreshContextMenus };
