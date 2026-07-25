export function setupTabCapture(): void {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (typeof message !== 'object' || message === null) return false;
    const msg = message as Record<string, unknown>;
    if (msg.type !== 'saywa:capture-visible-tab') return false;

    const windowId = sender.tab?.windowId ?? chrome.windows.WINDOW_ID_CURRENT;

    chrome.tabs.captureVisibleTab(windowId, { format: 'jpeg', quality: 90 }, (dataUrl) => {
      if (chrome.runtime.lastError || !dataUrl) {
        sendResponse({ error: chrome.runtime.lastError?.message ?? 'Capture failed' });
        return;
      }
      sendResponse({ dataUrl });
    });

    return true;
  });
}
