import type { StreamChunk } from '../domain/provider/provider.schema';
import type { ConversationId, MessageId } from '../domain/shared/ids';

/** Push streaming updates to UI (Chrome runtime, WebSocket, etc.). */
export interface StreamEventsPort {
  emitStreamChunk(conversationId: ConversationId, chunk: StreamChunk): void;
  emitStreamError(conversationId: ConversationId, error: string): void;
  emitStreamDone(conversationId: ConversationId, messageId: MessageId): void;
}
