import type {
  PushEvent,
  PushEventPayload,
  RpcMethod,
  RpcPayload,
  RpcResponse,
} from '@/infrastructure/messaging/message-types';

type RpcHandler = (payload: unknown) => Promise<unknown>;

export class DesktopRpcClient {
  private handlers = new Map<RpcMethod, RpcHandler>();

  register<M extends RpcMethod>(
    method: M,
    handler: (payload: RpcPayload<M>) => Promise<RpcResponse<M>>,
  ): void {
    this.handlers.set(method, handler as RpcHandler);
  }

  async call<M extends RpcMethod>(
    method: M,
    payload: RpcPayload<M>,
    _options?: unknown,
  ): Promise<RpcResponse<M>> {
    const handler = this.handlers.get(method);
    if (!handler) {
      throw new Error(`Unknown RPC method: ${method}`);
    }
    return (await handler(payload)) as RpcResponse<M>;
  }
}

export class DesktopPushListener {
  private listeners = new Map<string, Set<(payload: unknown) => void>>();
  private streamBuffers = new Map<
    string,
    { content: string; done: boolean; error: string | null }
  >();

  getBufferedStream(conversationId: string) {
    return this.streamBuffers.get(conversationId);
  }

  subscribe<E extends PushEvent>(
    event: E,
    callback: (payload: PushEventPayload<E>) => void,
  ): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)?.add(callback as (payload: unknown) => void);
    return () => {
      this.listeners.get(event)?.delete(callback as (payload: unknown) => void);
    };
  }

  /** No-op on desktop — events are wired in-process at bootstrap. */
  listen(): void {}

  emit<E extends PushEvent>(event: E, payload: PushEventPayload<E>): void {
    if (event.startsWith('stream:')) {
      this.recordStreamEvent(event, payload);
    }
    const callbacks = this.listeners.get(event);
    callbacks?.forEach((cb) => cb(payload));
  }

  private recordStreamEvent(event: PushEvent, payload: unknown): void {
    if (event === 'stream:chunk') {
      const p = payload as { conversationId: string; chunk: { type: string; content?: string } };
      const existing = this.streamBuffers.get(p.conversationId);
      const buf =
        existing?.done === true
          ? { content: '', done: false, error: null }
          : (existing ?? { content: '', done: false, error: null });
      if (p.chunk.type === 'text' && p.chunk.content) {
        buf.content += p.chunk.content;
      }
      this.streamBuffers.set(p.conversationId, buf);
    } else if (event === 'stream:done') {
      const p = payload as { conversationId: string };
      const buf = this.streamBuffers.get(p.conversationId) ?? {
        content: '',
        done: false,
        error: null,
      };
      buf.done = true;
      this.streamBuffers.set(p.conversationId, buf);
    } else if (event === 'stream:error') {
      const p = payload as { conversationId: string; error: string };
      this.streamBuffers.set(p.conversationId, {
        content: '',
        done: true,
        error: p.error,
      });
    }
  }
}

export const rpcClient = new DesktopRpcClient();
export const pushListener = new DesktopPushListener();
