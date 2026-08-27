import type { StreamEventsPort } from '@selectmind/core';
import { PushEmitter } from '@/infrastructure/messaging/rpc-client';

/** Chrome extension: stream events via chrome.runtime messaging. */
export class ChromeStreamEventsAdapter implements StreamEventsPort {
  private readonly emitter = new PushEmitter();

  emitStreamChunk(
    conversationId: Parameters<StreamEventsPort['emitStreamChunk']>[0],
    chunk: Parameters<StreamEventsPort['emitStreamChunk']>[1],
  ): void {
    this.emitter.emit('stream:chunk', { conversationId, chunk });
  }

  emitStreamError(
    conversationId: Parameters<StreamEventsPort['emitStreamError']>[0],
    error: string,
  ): void {
    this.emitter.emit('stream:error', { conversationId, error });
  }

  emitStreamDone(
    conversationId: Parameters<StreamEventsPort['emitStreamDone']>[0],
    messageId: Parameters<StreamEventsPort['emitStreamDone']>[1],
  ): void {
    this.emitter.emit('stream:done', { conversationId, messageId });
  }
}
