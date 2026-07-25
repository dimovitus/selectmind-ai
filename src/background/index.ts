import { ensureDatabaseSeeded } from './seed';
import { setupMessageRouter } from './message-router';
import { setupTabCapture } from './tab-capture';
import { setupLifecycleWithCleanup } from './lifecycle-cleanup';
import { setupContextMenus } from './context-menus';

// Register RPC handlers immediately so content scripts can connect before seed finishes
setupMessageRouter();
setupTabCapture();

void ensureDatabaseSeeded().then(() => {
  setupLifecycleWithCleanup();
  setupContextMenus();
});
