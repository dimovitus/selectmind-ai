import type { Conversation, Message } from '@/domain/conversation/conversation.schema';
import type { ConversationId } from '@/domain/shared/ids';
import type { ConversationRepositoryPort, MessageRepositoryPort } from '@selectmind/core';
import { getDB } from '../indexeddb.adapter';

export type { ConversationRepositoryPort, MessageRepositoryPort };

export class ConversationRepository implements ConversationRepositoryPort {
  async getById(id: ConversationId): Promise<Conversation | null> {
    return (await getDB().conversations.get(id)) ?? null;
  }

  async save(conversation: Conversation): Promise<void> {
    await getDB().conversations.put(conversation);
  }

  async delete(id: ConversationId): Promise<void> {
    await getDB().conversations.delete(id);
    await getDB().messages.where('conversationId').equals(id).delete();
  }

  async deleteAll(): Promise<number> {
    const count = await getDB().conversations.count();
    await getDB().transaction('rw', getDB().conversations, getDB().messages, async () => {
      await getDB().messages.clear();
      await getDB().conversations.clear();
    });
    return count;
  }

  async getRecent(limit: number): Promise<Conversation[]> {
    const all = await getDB().conversations.orderBy('updatedAt').reverse().limit(limit * 3).toArray();
    return all.filter((c) => !c.ephemeral).slice(0, limit);
  }

  async deleteOlderThan(cutoff: number): Promise<number> {
    const stale = await getDB().conversations.where('updatedAt').below(cutoff).toArray();
    for (const conversation of stale) {
      await this.delete(conversation.id);
    }
    return stale.length;
  }
}

export class MessageRepository implements MessageRepositoryPort {
  async getByConversation(conversationId: ConversationId): Promise<Message[]> {
    return getDB().messages.where('conversationId').equals(conversationId).sortBy('createdAt');
  }

  async getByConversationPaginated(
    conversationId: ConversationId,
    options: { limit?: number; before?: number } = {},
  ): Promise<{ messages: Message[]; hasMore: boolean }> {
    const limit = options.limit ?? 50;
    let query = getDB().messages.where('conversationId').equals(conversationId);

    if (options.before) {
      query = query.filter((m) => m.createdAt < options.before!);
    }

    const all = await query.sortBy('createdAt');
    const hasMore = all.length > limit;
    const messages = hasMore ? all.slice(all.length - limit) : all;

    return { messages, hasMore };
  }

  async save(message: Message): Promise<void> {
    await getDB().messages.put(message);
  }

  async saveMany(messages: Message[]): Promise<void> {
    await getDB().messages.bulkPut(messages);
  }
}
