import { ensureDatabaseSeeded } from './seed';
import { setupMessageRouter } from './message-router';
import { setupLifecycleWithCleanup } from './lifecycle-cleanup';

// Register RPC handlers immediately so content scripts can connect before seed finishes
setupMessageRouter();

void ensureDatabaseSeeded().then(() => {
  setupLifecycleWithCleanup();
});
