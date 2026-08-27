/** Cross-browser helpers for Chrome, Firefox, and Zen (Firefox-based). */

interface SidebarActionApi {
  open: () => Promise<void>;
  close?: () => Promise<void>;
  toggle?: () => Promise<void>;
}

type ChromeWithSidebar = typeof chrome & {
  sidebarAction?: SidebarActionApi;
};

type BrowserWithSidebar = {
  sidebarAction?: SidebarActionApi;
};

export function isFirefox(): boolean {
  const runtime = (globalThis as { browser?: { runtime?: { getBrowserInfo?: unknown } } }).browser;
  if (runtime?.runtime?.getBrowserInfo) return true;
  return typeof navigator !== 'undefined' && /firefox|zen/i.test(navigator.userAgent);
}

function getSidebarAction(): SidebarActionApi | undefined {
  const chromeApi = globalThis.chrome as ChromeWithSidebar | undefined;
  if (chromeApi?.sidebarAction?.open) return chromeApi.sidebarAction;

  const browserApi = (globalThis as { browser?: BrowserWithSidebar }).browser;
  return browserApi?.sidebarAction;
}

/**
 * Open the workspace UI: Chrome Side Panel, or Firefox/Zen sidebar.
 * Firefox `sidebarAction.open()` needs a user gesture; callers should tolerate failure.
 */
export async function openWorkspacePanel(tabId?: number): Promise<void> {
  if (tabId != null && chrome.sidePanel?.open) {
    await chrome.sidePanel.open({ tabId });
    return;
  }

  const sidebar = getSidebarAction();
  if (sidebar?.open) {
    await sidebar.open();
    return;
  }

  if (tabId != null) {
    throw new Error('Workspace panel API is not available');
  }
}
