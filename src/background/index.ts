import { ensureDatabaseSeeded } from './seed';
import { setupMessageRouter } from './message-router';
import { setupTabCapture } from './tab-capture';
import { setupLifecycleWithCleanup } from './lifecycle-cleanup';
import { refreshContextMenus, setupContextMenus } from './context-menus';

// Register RPC handlers immediately so content scripts can connect before seed finishes
setupMessageRouter();
setupTabCapture();
// Context menus must register while the service worker is active (store review checks this).
setupContextMenus();

void ensureDatabaseSeeded().then(() => {
  setupLifecycleWithCleanup();
  void refreshContextMenus();
});
