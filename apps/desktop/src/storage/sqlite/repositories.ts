import type { Action, Category } from '@selectmind/core';
import type { Conversation, Message } from '@selectmind/core';
import type { Pipeline, ProviderConfig } from '@selectmind/core';
import type {
  ActionRepositoryPort,
  CategoryRepositoryPort,
  ConversationRepositoryPort,
  MessageRepositoryPort,
  PipelineRepositoryPort,
  ProviderRepositoryPort,
} from '@selectmind/core';
import type { ActionId, ConversationId, PipelineId, ProviderId } from '@selectmind/core';
import { getDatabase } from './db';

type Row = { data: string };

async function selectOne<T>(sql: string, bind: unknown[] = []): Promise<T | null> {
  const db = await getDatabase();
  const rows = await db.select<Row[]>(sql, bind);
  const row = rows[0];
  return row ? (JSON.parse(row.data) as T) : null;
}

async function selectMany<T>(sql: string, bind: unknown[] = []): Promise<T[]> {
  const db = await getDatabase();
  const rows = await db.select<Row[]>(sql, bind);
  return rows.map((row) => JSON.parse(row.data) as T);
}

export class SqliteActionRepository implements ActionRepositoryPort {
  async getAll(): Promise<Action[]> {
    return selectMany<Action>('SELECT data FROM actions ORDER BY sort_order ASC');
  }

  async getById(id: ActionId): Promise<Action | null> {
    return selectOne<Action>('SELECT data FROM actions WHERE id = $1', [id]);
  }

  async getByCategory(categoryId: string): Promise<Action[]> {
    return selectMany<Action>(
      'SELECT data FROM actions WHERE category_id = $1 ORDER BY sort_order ASC',
      [categoryId],
    );
  }

  async getToolbarActions(limit: number): Promise<Action[]> {
    const actions = await this.getAll();
    return actions.filter((a) => a.isEnabled).slice(0, limit);
  }

  async save(action: Action): Promise<void> {
    const db = await getDatabase();
    await db.execute(
      `INSERT INTO actions (id, category_id, sort_order, data) VALUES ($1, $2, $3, $4)
       ON CONFLICT(id) DO UPDATE SET category_id = $2, sort_order = $3, data = $4`,
      [action.id, action.categoryId, action.order, JSON.stringify(action)],
    );
  }

  async saveMany(actions: Action[]): Promise<void> {
    for (const action of actions) {
      await this.save(action);
    }
  }

  async delete(id: ActionId): Promise<void> {
    const db = await getDatabase();
    await db.execute('DELETE FROM actions WHERE id = $1', [id]);
  }
}

export class SqliteCategoryRepository implements CategoryRepositoryPort {
  async getAll(): Promise<Category[]> {
    return selectMany<Category>('SELECT data FROM categories ORDER BY sort_order ASC');
  }

  async getById(id: string): Promise<Category | null> {
    return selectOne<Category>('SELECT data FROM categories WHERE id = $1', [id]);
  }

  async save(category: Category): Promise<void> {
    const db = await getDatabase();
    await db.execute(
      `INSERT INTO categories (id, sort_order, data) VALUES ($1, $2, $3)
       ON CONFLICT(id) DO UPDATE SET sort_order = $2, data = $3`,
      [category.id, category.order, JSON.stringify(category)],
    );
  }

  async saveMany(categories: Category[]): Promise<void> {
    for (const category of categories) {
      await this.save(category);
    }
  }

  async delete(id: string): Promise<void> {
    const db = await getDatabase();
    await db.execute('DELETE FROM categories WHERE id = $1', [id]);
  }
}

export class SqliteProviderRepository implements ProviderRepositoryPort {
  async getAll(): Promise<ProviderConfig[]> {
    return selectMany<ProviderConfig>('SELECT data FROM providers');
  }

  async getById(id: ProviderId): Promise<ProviderConfig | null> {
    return selectOne<ProviderConfig>('SELECT data FROM providers WHERE id = $1', [id]);
  }

  async save(provider: ProviderConfig): Promise<void> {
    const db = await getDatabase();
    await db.execute(
      `INSERT INTO providers (id, data) VALUES ($1, $2)
       ON CONFLICT(id) DO UPDATE SET data = $2`,
      [provider.id, JSON.stringify(provider)],
    );
  }

  async delete(id: ProviderId): Promise<void> {
    const db = await getDatabase();
    await db.execute('DELETE FROM providers WHERE id = $1', [id]);
  }
}

export class SqlitePipelineRepository implements PipelineRepositoryPort {
  async getAll(): Promise<Pipeline[]> {
    return selectMany<Pipeline>('SELECT data FROM pipelines');
  }

  async getById(id: PipelineId): Promise<Pipeline | null> {
    return selectOne<Pipeline>('SELECT data FROM pipelines WHERE id = $1', [id]);
  }

  async save(pipeline: Pipeline): Promise<void> {
    const db = await getDatabase();
    await db.execute(
      `INSERT INTO pipelines (id, data) VALUES ($1, $2)
       ON CONFLICT(id) DO UPDATE SET data = $2`,
      [pipeline.id, JSON.stringify(pipeline)],
    );
  }

  async saveMany(pipelines: Pipeline[]): Promise<void> {
    for (const pipeline of pipelines) {
      await this.save(pipeline);
    }
  }

  async delete(id: PipelineId): Promise<void> {
    const db = await getDatabase();
    await db.execute('DELETE FROM pipelines WHERE id = $1', [id]);
  }
}

export class SqliteConversationRepository implements ConversationRepositoryPort {
  async getById(id: ConversationId): Promise<Conversation | null> {
    return selectOne<Conversation>('SELECT data FROM conversations WHERE id = $1', [id]);
  }

  async save(conversation: Conversation): Promise<void> {
    const db = await getDatabase();
    await db.execute(
      `INSERT INTO conversations (id, updated_at, data) VALUES ($1, $2, $3)
       ON CONFLICT(id) DO UPDATE SET updated_at = $2, data = $3`,
      [conversation.id, conversation.updatedAt, JSON.stringify(conversation)],
    );
  }

  async delete(id: ConversationId): Promise<void> {
    const db = await getDatabase();
    await db.execute('DELETE FROM conversations WHERE id = $1', [id]);
    await db.execute('DELETE FROM messages WHERE conversation_id = $1', [id]);
  }

  async deleteAll(): Promise<number> {
    const db = await getDatabase();
    const countRows = await db.select<Array<{ count: number }>>(
      'SELECT COUNT(*) as count FROM conversations',
    );
    const count = countRows[0]?.count ?? 0;
    await db.execute('DELETE FROM messages');
    await db.execute('DELETE FROM conversations');
    return count;
  }

  async getRecent(limit: number): Promise<Conversation[]> {
    const all = await selectMany<Conversation>(
      'SELECT data FROM conversations ORDER BY updated_at DESC LIMIT $1',
      [limit * 3],
    );
    return all.filter((c) => !c.ephemeral).slice(0, limit);
  }
}

export class SqliteMessageRepository implements MessageRepositoryPort {
  async getByConversation(conversationId: ConversationId): Promise<Message[]> {
    return selectMany<Message>(
      'SELECT data FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC',
      [conversationId],
    );
  }

  async getByConversationPaginated(
    conversationId: ConversationId,
    options: { limit?: number; before?: number } = {},
  ): Promise<{ messages: Message[]; hasMore: boolean }> {
    const limit = options.limit ?? 50;
    let messages = await this.getByConversation(conversationId);
    if (options.before) {
      messages = messages.filter((m) => m.createdAt < options.before!);
    }
    const hasMore = messages.length > limit;
    const slice = hasMore ? messages.slice(messages.length - limit) : messages;
    return { messages: slice, hasMore };
  }

  async save(message: Message): Promise<void> {
    const db = await getDatabase();
    await db.execute(
      `INSERT INTO messages (id, conversation_id, created_at, data) VALUES ($1, $2, $3, $4)
       ON CONFLICT(id) DO UPDATE SET conversation_id = $2, created_at = $3, data = $4`,
      [message.id, message.conversationId, message.createdAt, JSON.stringify(message)],
    );
  }

  async saveMany(messages: Message[]): Promise<void> {
    for (const message of messages) {
      await this.save(message);
    }
  }
}
