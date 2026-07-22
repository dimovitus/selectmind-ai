import { nanoid } from 'nanoid';
import type {
  PushEvent,
  PushEventPayload,
  RpcMethod,
  RpcPayload,
  RpcResponse,
  RuntimeMessage,
  RuntimeResponse,
  PushMessage,
} from './message-types';
import { isPushMessage, isRuntimeMessage } from './message-types';

const RPC_TIMEOUT_MS = 30_000;
const RPC_MAX_RETRIES = 4;
const RPC_RETRY_DELAY_MS = 350;

export interface RpcCallOptions {
  timeoutMs?: number;
  maxRetries?: number;
  retryDelayMs?: number;
}

function isRetriableRpcError(message: string): boolean {
  if (message.includes('Extension context invalidated') || message.includes('context invalidated')) {
    return false;
  }
  return (
    message.includes('Receiving end does not exist') ||
    message.includes('Could not establish connection') ||
    message.includes('No response for RPC') ||
    message.includes('RPC timeout')
  );
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class RpcClient {
  async call<M extends RpcMethod>(
    method: M,
    payload: RpcPayload<M>,
    options?: RpcCallOptions,
  ): Promise<RpcResponse<M>> {
    const timeoutMs = options?.timeoutMs ?? RPC_TIMEOUT_MS;
    const maxRetries = options?.maxRetries ?? RPC_MAX_RETRIES;
    const retryDelayMs = options?.retryDelayMs ?? RPC_RETRY_DELAY_MS;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await this.callOnce(method, payload, timeoutMs);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt >= maxRetries - 1 || !isRetriableRpcError(lastError.message)) {
          throw lastError;
        }
        await delay(retryDelayMs * (attempt + 1));
      }
    }

    throw lastError ?? new Error(`RPC failed: ${method}`);
  }

  private async callOnce<M extends RpcMethod>(
    method: M,
    payload: RpcPayload<M>,
    timeoutMs: number,
  ): Promise<RpcResponse<M>> {
    const id = nanoid();
    const message: RuntimeMessage<M> = {
      channel: 'saywa-rpc',
      id,
      method,
      payload,
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`RPC timeout: ${method}`));
      }, timeoutMs);

      chrome.runtime.sendMessage(message, (response: RuntimeResponse<M> | undefined) => {
        clearTimeout(timeout);

        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        if (!response) {
          reject(new Error(`No response for RPC: ${method}`));
          return;
        }

        if (!response.success) {
          reject(new Error(response.error ?? `RPC failed: ${method}`));
          return;
        }

        resolve(response.data as RpcResponse<M>);
      });
    });
  }
}

export class RpcServer {
  private handlers = new Map<RpcMethod, (payload: unknown) => Promise<unknown>>();
  private isListening = false;

  register<M extends RpcMethod>(
    method: M,
    handler: (payload: RpcPayload<M>) => Promise<RpcResponse<M>>,
  ): void {
    this.handlers.set(method, handler as (payload: unknown) => Promise<unknown>);
  }

  listen(): void {
    if (this.isListening) return;
    this.isListening = true;

    chrome.runtime.onMessage.addListener(
      (message: unknown, _sender, sendResponse: (response: unknown) => void) => {
        if (!isRuntimeMessage(message)) return false;

        const handler = this.handlers.get(message.method);
        if (!handler) {
          sendResponse({
            channel: 'saywa-rpc',
            id: message.id,
            success: false,
            error: `Unknown method: ${message.method}`,
          } satisfies RuntimeResponse);
          return false;
        }

        void handler(message.payload)
          .then((data) => {
            sendResponse({
              channel: 'saywa-rpc',
              id: message.id,
              success: true,
              data,
            } as RuntimeResponse);
          })
          .catch((error: unknown) => {
            sendResponse({
              channel: 'saywa-rpc',
              id: message.id,
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
            } satisfies RuntimeResponse);
          });

        return true;
      },
    );
  }
}

export class PushEmitter {
  emit<E extends PushEvent>(event: E, payload: PushEventPayload<E>): void {
    const message: PushMessage<E> = {
      channel: 'saywa-push',
      event,
      payload,
    };

    void chrome.runtime.sendMessage(message).catch(() => {
      // No receiver yet — content script may still be mounting
    });

    void chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      if (tab?.id) {
        void chrome.tabs.sendMessage(tab.id, message).catch(() => {});
      }
    });
  }
}

export class PushListener {
  private listeners = new Map<string, Set<(payload: unknown) => void>>();
  private isListening = false;
  private streamBuffers = new Map<
    string,
    { content: string; done: boolean; error: string | null }
  >();

  getBufferedStream(conversationId: string) {
    return this.streamBuffers.get(conversationId);
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

  listen(): void {
    if (this.isListening) return;
    this.isListening = true;

    const handler = (message: unknown) => {
      if (!isPushMessage(message)) return;
      if (message.event.startsWith('stream:')) {
        this.recordStreamEvent(message.event, message.payload);
      }
      const callbacks = this.listeners.get(message.event);
      callbacks?.forEach((cb) => {
        cb(message.payload);
      });
    };

    chrome.runtime.onMessage.addListener(handler);
  }
}

export const rpcClient = new RpcClient();
export const pushListener = new PushListener();
