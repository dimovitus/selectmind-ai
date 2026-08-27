import type { ActionId, ConversationId, ProviderId, CategoryId, PipelineId } from '@/domain/shared/ids';
import type { Action, Category } from '@/domain/action/action.schema';
import type {
  Conversation,
  ContextBundle,
  ContextFragment,
  Message,
  ConversationMode,
} from '@/domain/conversation/conversation.schema';
import type { ProviderConfig, ModelInfo, StreamChunk, Pipeline } from '@/domain/provider/provider.schema';
import type { ExportBundle } from '@/application/import-export.use-case';
import type { PageContext } from '@/shared/types/page-context';
import type { Settings } from '@/shared/types/settings';

export interface RpcRequestMap {
  'action:list': { payload: undefined; response: Action[] };
  'action:toolbar': { payload: undefined; response: Action[] };
  'action:get': { payload: { actionId: ActionId }; response: Action | null };
  'action:save': { payload: { action: Action }; response: Action };
  'action:delete': { payload: { actionId: ActionId }; response: void };
  'action:execute': {
    payload: { actionId: ActionId; context: PageContext };
    response: { conversationId: ConversationId };
  };
  'action:execute-in-conversation': {
    payload: { actionId: ActionId; context: PageContext; conversationId: ConversationId };
    response: { conversationId: ConversationId };
  };
  'pipeline:list': { payload: undefined; response: Pipeline[] };
  'pipeline:run': {
    payload: { pipelineId: PipelineId; context: PageContext };
    response: { conversationId: ConversationId };
  };
  'export:bundle': { payload: undefined; response: ExportBundle };
  'import:bundle': { payload: { bundle: ExportBundle }; response: { imported: number } };
  'category:list': { payload: undefined; response: Category[] };
  'category:save': { payload: { category: Category }; response: Category };
  'category:delete': { payload: { categoryId: CategoryId }; response: void };
  'conversation:create': {
    payload: { mode: ConversationMode; contextBundle: ContextBundle; sourceActionId?: ActionId };
    response: { conversationId: ConversationId };
  };
  'conversation:get': {
    payload: { conversationId: ConversationId };
    response: Conversation | null;
  };
  'conversation:messages': {
    payload: { conversationId: ConversationId; limit?: number; before?: number };
    response: { messages: Message[]; hasMore: boolean };
  };
  'conversation:list': {
    payload: { limit?: number } | undefined;
    response: Conversation[];
  };
  'conversation:clear-all': { payload: undefined; response: { deleted: number } };
  'conversation:delete': { payload: { conversationId: ConversationId }; response: void };
  'conversation:promote': {
    payload: { conversationId: ConversationId; mode: ConversationMode };
    response: Conversation;
  };
  'conversation:continue': {
    payload: { conversationId: ConversationId; message: string };
    response: { messageId: string };
  };
  /** Start (or retry) the assistant turn without appending a user message. */
  'conversation:start-assistant': {
    payload: { conversationId: ConversationId };
    response: { started: boolean };
  };
  'conversation:add-context': {
    payload: { conversationId: ConversationId; fragment: ContextFragment };
    response: void;
  };
  'secrets:has-key': {
    payload: { providerId: ProviderId };
    response: { hasKey: boolean };
  };
  'context:get': { payload: undefined; response: PageContext };
  'provider:list': { payload: undefined; response: ProviderConfig[] };
  'provider:save': {
    payload: { config: ProviderConfig; apiKey?: string };
    response: ProviderConfig;
  };
  'provider:delete': { payload: { providerId: ProviderId }; response: void };
  'provider:models': {
    payload: { providerId: ProviderId; apiKey?: string };
    response: ModelInfo[];
  };
  'settings:get': { payload: undefined; response: Settings };
  'settings:update': { payload: Partial<Settings>; response: Settings };
  'ping': { payload: undefined; response: { pong: true; timestamp: number } };
}

export interface PushEventMap {
  'stream:chunk': { conversationId: ConversationId; chunk: StreamChunk };
  'stream:done': { conversationId: ConversationId; messageId: string };
  'stream:error': { conversationId: ConversationId; error: string };
  'context:updated': { conversationId: ConversationId };
}

export type RpcMethod = keyof RpcRequestMap;

export type RpcPayload<M extends RpcMethod> = RpcRequestMap[M]['payload'];
export type RpcResponse<M extends RpcMethod> = RpcRequestMap[M]['response'];

export type PushEvent = keyof PushEventMap;
export type PushEventPayload<E extends PushEvent> = PushEventMap[E];

export interface RuntimeMessage<M extends RpcMethod = RpcMethod> {
  channel: 'saywa-rpc';
  id: string;
  method: M;
  payload: RpcPayload<M>;
}

export interface RuntimeResponse<M extends RpcMethod = RpcMethod> {
  channel: 'saywa-rpc';
  id: string;
  success: boolean;
  data?: RpcResponse<M>;
  error?: string;
}

export interface PushMessage<E extends PushEvent = PushEvent> {
  channel: 'saywa-push';
  event: E;
  payload: PushEventPayload<E>;
}

export function isRuntimeMessage(msg: unknown): msg is RuntimeMessage {
  return (
    typeof msg === 'object' &&
    msg !== null &&
    'channel' in msg &&
    (msg as RuntimeMessage).channel === 'saywa-rpc'
  );
}

export function isPushMessage(msg: unknown): msg is PushMessage {
  return (
    typeof msg === 'object' &&
    msg !== null &&
    'channel' in msg &&
    (msg as PushMessage).channel === 'saywa-push'
  );
}
