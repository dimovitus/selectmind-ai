import type { Action } from '../domain/action/action.schema';
import type { Category } from '../domain/action/action.schema';
import type { Conversation, Message } from '../domain/conversation/conversation.schema';
import type { Pipeline, ProviderConfig } from '../domain/provider/provider.schema';
import type { ActionId, ConversationId, PipelineId, ProviderId } from '../domain/shared/ids';

export interface ActionRepositoryPort {
  getAll(): Promise<Action[]>;
  getById(id: ActionId): Promise<Action | null>;
  getByCategory(categoryId: string): Promise<Action[]>;
  getToolbarActions(limit: number): Promise<Action[]>;
  save(action: Action): Promise<void>;
  saveMany(actions: Action[]): Promise<void>;
  delete(id: ActionId): Promise<void>;
}

export interface CategoryRepositoryPort {
  getAll(): Promise<Category[]>;
  getById(id: string): Promise<Category | null>;
  save(category: Category): Promise<void>;
  saveMany(categories: Category[]): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface ConversationRepositoryPort {
  getById(id: ConversationId): Promise<Conversation | null>;
  save(conversation: Conversation): Promise<void>;
  delete(id: ConversationId): Promise<void>;
  deleteAll(): Promise<number>;
  getRecent(limit: number): Promise<Conversation[]>;
}

export interface MessageRepositoryPort {
  getByConversation(conversationId: ConversationId): Promise<Message[]>;
  getByConversationPaginated(
    conversationId: ConversationId,
    options?: { limit?: number; before?: number },
  ): Promise<{ messages: Message[]; hasMore: boolean }>;
  save(message: Message): Promise<void>;
  saveMany(messages: Message[]): Promise<void>;
}

export interface ProviderRepositoryPort {
  getAll(): Promise<ProviderConfig[]>;
  getById(id: ProviderId): Promise<ProviderConfig | null>;
  save(provider: ProviderConfig): Promise<void>;
  delete(id: ProviderId): Promise<void>;
}

export interface PipelineRepositoryPort {
  getAll(): Promise<Pipeline[]>;
  getById(id: PipelineId): Promise<Pipeline | null>;
  save(pipeline: Pipeline): Promise<void>;
  saveMany(pipelines: Pipeline[]): Promise<void>;
  delete(id: PipelineId): Promise<void>;
}
