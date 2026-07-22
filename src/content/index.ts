import { initContentUI } from './ui/ContentApp';
import { extractPageContext } from './page-context-extractor';

initContentUI();

chrome.runtime.onMessage.addListener((message: unknown) => {
  if (typeof message !== 'object' || message === null) return;

  const msg = message as Record<string, unknown>;

  if (msg.type === 'saywa:get-context') {
    return true;
  }

  if (msg.type === 'saywa:open-palette') {
    // Phase 4: Command Palette in content script
  }
});

// Expose context extraction for background relay
chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  if (typeof message !== 'object' || message === null) return false;

  const msg = message as Record<string, unknown>;
  if (msg.type === 'saywa:extract-context') {
    sendResponse(extractPageContext());
    return true;
  }
  return false;
});
