import type { StreamChunk, StreamEventsPort, ConversationId, MessageId } from '@selectmind/core';

type StreamListener = (event: StreamEvent) => void;

export type StreamEvent =
  | { type: 'chunk'; conversationId: ConversationId; chunk: StreamChunk }
  | { type: 'error'; conversationId: ConversationId; error: string }
  | { type: 'done'; conversationId: ConversationId; messageId: MessageId };

/** Desktop: in-process event bus (Phase 1+ → Tauri events / IPC). */
export class TauriStreamEventsAdapter implements StreamEventsPort {
  private listeners = new Set<StreamListener>();

  subscribe(listener: StreamListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emitStreamChunk(
    conversationId: Parameters<StreamEventsPort['emitStreamChunk']>[0],
    chunk: Parameters<StreamEventsPort['emitStreamChunk']>[1],
  ): void {
    this.dispatch({ type: 'chunk', conversationId, chunk });
  }

  emitStreamError(
    conversationId: Parameters<StreamEventsPort['emitStreamError']>[0],
    error: string,
  ): void {
    this.dispatch({ type: 'error', conversationId, error });
  }

  emitStreamDone(
    conversationId: Parameters<StreamEventsPort['emitStreamDone']>[0],
    messageId: Parameters<StreamEventsPort['emitStreamDone']>[1],
  ): void {
    this.dispatch({ type: 'done', conversationId, messageId });
  }

  private dispatch(event: StreamEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}
