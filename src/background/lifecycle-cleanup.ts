import { setupLifecycle } from './lifecycle';
import { cleanupOldConversations } from './cleanup';
import { LOG_PREFIX } from '@/shared/constants/brand';

const CLEANUP_ALARM = 'saywa:cleanup-conversations';

export function setupLifecycleWithCleanup(): void {
  setupLifecycle();

  chrome.alarms.create(CLEANUP_ALARM, { periodInMinutes: 24 * 60 });

  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === CLEANUP_ALARM) {
      void cleanupOldConversations().then((count) => {
        if (count > 0) {
          console.info(`${LOG_PREFIX} Cleaned up ${count} old conversations`);
        }
      });
    }
  });

  void cleanupOldConversations();
}
