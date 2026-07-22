import { getContainer } from '@/di/container';

export async function cleanupOldConversations(): Promise<number> {
  const { settingsRepo, conversationRepo } = getContainer();
  const settings = await settingsRepo.get();
  const cutoff = Date.now() - settings.conversationRetentionDays * 86_400_000;

  const deleted = await conversationRepo.deleteOlderThan(cutoff);
  return deleted;
}
