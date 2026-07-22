import Dexie, { type Table } from 'dexie';
import type { Action, Category } from '@/domain/action/action.schema';
import type { Conversation, Message } from '@/domain/conversation/conversation.schema';
import type { Pipeline, ProviderConfig } from '@/domain/provider/provider.schema';

export class SayWaDB extends Dexie {
  actions!: Table<Action, string>;
  categories!: Table<Category, string>;
  conversations!: Table<Conversation, string>;
  messages!: Table<Message, string>;
  pipelines!: Table<Pipeline, string>;
  providers!: Table<ProviderConfig, string>;

  constructor() {
    super('SayWaDB');

    this.version(1).stores({
      actions: 'id, categoryId, isEnabled, order, isBuiltIn',
      categories: 'id, order, isBuiltIn',
      conversations: 'id, mode, createdAt, updatedAt',
      messages: 'id, conversationId, createdAt',
      pipelines: 'id, isBuiltIn',
      providers: 'id, enabled, type',
    });
  }
}

let dbInstance: SayWaDB | null = null;

export function getDB(): SayWaDB {
  if (!dbInstance) {
    dbInstance = new SayWaDB();
  }
  return dbInstance;
}

export async function resetDB(): Promise<void> {
  if (dbInstance) {
    await dbInstance.delete();
    dbInstance = null;
  }
}
