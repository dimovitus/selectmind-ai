import { useEffect, useState, useCallback, useRef } from 'react';
import type { ConversationId } from '@/domain/shared/ids';
import { pushListener, rpcClient } from '@/infrastructure/messaging/rpc-client';

interface StreamingState {
  content: string;
  isStreaming: boolean;
  error: string | null;
  isDone: boolean;
}

async function fetchAssistantMessage(
  conversationId: ConversationId,
  minAssistantCount = 1,
): Promise<string | null> {
  const { messages } = await rpcClient.call('conversation:messages', { conversationId });
  const assistants = messages.filter((m) => m.role === 'assistant');
  if (assistants.length < minAssistantCount) return null;
  return assistants.at(-1)?.content ?? null;
}

export function useStreaming(
  conversationId: ConversationId | null,
  /** Increment to start a fresh assistant turn (follow-up messages). */
  turn = 0,
  expectedAssistantCount = 1,
): StreamingState {
  const [content, setContent] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDone, setIsDone] = useState(false);
  const startedRef = useRef(false);
  const isDoneRef = useRef(false);

  const reset = useCallback(() => {
    setContent('');
    setIsStreaming(false);
    setError(null);
    setIsDone(false);
    startedRef.current = false;
    isDoneRef.current = false;
  }, []);

  useEffect(() => {
    if (!conversationId) {
      reset();
      return;
    }

    reset();
    pushListener.listen();

    const applyBuffer = () => {
      const buffered = pushListener.getBufferedStream(conversationId);
      if (!buffered) return;
      if (buffered.error) {
        setError(buffered.error);
        setIsStreaming(false);
        return;
      }
      if (buffered.content) {
        startedRef.current = true;
        setContent(buffered.content);
        setIsStreaming(!buffered.done);
        if (buffered.done) {
          setIsDone(true);
        }
      }
    };

    applyBuffer();

    const unsubChunk = pushListener.subscribe('stream:chunk', (payload) => {
      if (payload.conversationId !== conversationId) return;
      const { chunk } = payload;
      if (chunk.type === 'text') {
        startedRef.current = true;
        setIsStreaming(true);
        setError(null);
        if (isDoneRef.current) {
          isDoneRef.current = false;
          setIsDone(false);
          setContent(chunk.content);
        } else {
          setContent((prev) => prev + chunk.content);
        }
      }
    });

    const unsubDone = pushListener.subscribe('stream:done', (payload) => {
      if (payload.conversationId !== conversationId) return;
      setIsStreaming(false);
      setIsDone(true);
      isDoneRef.current = true;
    });

    const unsubError = pushListener.subscribe('stream:error', (payload) => {
      if (payload.conversationId !== conversationId) return;
      setError(payload.error);
      setIsStreaming(false);
    });

    const pollFallback = async () => {
      try {
        const text = await fetchAssistantMessage(conversationId, expectedAssistantCount);
        if (text) {
          startedRef.current = true;
          setContent(text);
          setIsStreaming(false);
          setIsDone(true);
          isDoneRef.current = true;
        } else if (!startedRef.current) {
          setIsStreaming(false);
        }
      } catch {
        if (!startedRef.current) {
          setIsStreaming(false);
        }
      }
    };

    const t1 = window.setTimeout(() => {
      if (!startedRef.current) void pollFallback();
    }, 1500);
    const t2 = window.setTimeout(() => {
      if (!startedRef.current) void pollFallback();
    }, 4000);
    const t3 = window.setTimeout(() => {
      if (!startedRef.current) void pollFallback();
    }, 8000);

    return () => {
      unsubChunk();
      unsubDone();
      unsubError();
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, [conversationId, turn, expectedAssistantCount, reset]);

  return { content, isStreaming, error, isDone };
}
