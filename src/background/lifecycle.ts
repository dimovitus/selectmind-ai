export function setupLifecycle(): void {
  chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
      void chrome.runtime.openOptionsPage();
    }
  });

  chrome.action.onClicked.addListener(async (tab) => {
    if (tab.id) {
      await chrome.sidePanel.open({ tabId: tab.id });
    }
  });

  chrome.runtime.onMessage.addListener((message: unknown, sender) => {
    if (typeof message !== 'object' || message === null) return;

    const msg = message as Record<string, unknown>;

    if (msg.type === 'saywa:open-sidepanel') {
      const tabId = sender.tab?.id;
      if (tabId) {
        void chrome.sidePanel.open({ tabId }).then(() => {
          void chrome.runtime.sendMessage(message);
        });
      } else {
        void chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
          if (tab?.id) {
            void chrome.sidePanel.open({ tabId: tab.id }).then(() => {
              void chrome.runtime.sendMessage(message);
            });
          }
        });
      }
    }
  });

  chrome.commands.onCommand.addListener((command) => {
    switch (command) {
      case 'toggle-sidepanel':
        void chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
          if (tab?.id) {
            void chrome.sidePanel.open({ tabId: tab.id });
          }
        });
        break;
      case 'command-palette':
        void chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
          if (tab?.id) {
            void chrome.tabs.sendMessage(tab.id, { type: 'saywa:open-palette' });
          }
        });
        break;
      case 'capture-screen':
        void chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
          if (tab?.id) {
            void chrome.tabs.sendMessage(tab.id, {
              type: 'saywa:capture-screen',
              target: 'sidebar',
            });
          }
        });
        break;
    }
  });
}
