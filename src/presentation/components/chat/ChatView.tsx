import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { ConversationId } from '@/domain/shared/ids';
import type { Message } from '@/domain/conversation/conversation.schema';
import type { ContextBundle } from '@/domain/conversation/conversation.schema';
import type { PageContext } from '@/shared/types/page-context';
import { rpcClient } from '@/infrastructure/messaging/rpc-client';
import { pushListener } from '@/infrastructure/messaging/rpc-client';
import { useStreaming } from '@/presentation/hooks/useStreaming';
import { ContextChips, createContextFragment } from './ContextChips';
import { MessageBubble } from './MessageBubble';
import { MessageInput } from './MessageInput';
import { MarkdownRenderer } from '@/presentation/components/markdown/MarkdownRenderer';
import { ErrorDisplay } from '@/presentation/components/ui/ErrorDisplay';

const PAGE_SIZE = 30;

interface ChatViewProps {
  conversationId: ConversationId;
  contextBundle?: ContextBundle;
  onAddContext?: (fragment: ReturnType<typeof createContextFragment>) => Promise<void>;
  resolvePageContext?: () => PageContext | Promise<PageContext>;
  onOpenSettings?: () => void;
  compact?: boolean;
  hideInitialUserMessage?: boolean;
  inputPlaceholder?: string;
  className?: string;
}

export function ChatView({
  conversationId,
  contextBundle: initialBundle,
  onAddContext,
  resolvePageContext,
  onOpenSettings,
  compact,
  hideInitialUserMessage,
  inputPlaceholder,
  className,
}: ChatViewProps) {
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [awaitingResponse, setAwaitingResponse] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [streamTurn, setStreamTurn] = useState(0);
  const [expectedAssistantCount, setExpectedAssistantCount] = useState(1);
  const [contextNotice, setContextNotice] = useState<string | null>(null);
  const [olderMessages, setOlderMessages] = useState<Message[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { content, isStreaming, error, isDone } = useStreaming(
    conversationId,
    streamTurn,
    expectedAssistantCount,
  );

  const { data: conversation } = useQuery({
    queryKey: ['conversation', conversationId],
    queryFn: () => rpcClient.call('conversation:get', { conversationId }),
  });

  const contextBundle = conversation?.contextBundle ?? initialBundle;

  const { data: messagesData, refetch } = useQuery({
    queryKey: ['messages', conversationId, 'recent'],
    queryFn: () =>
      rpcClient.call('conversation:messages', { conversationId, limit: PAGE_SIZE }),
  });

  const recentMessages = messagesData?.messages ?? [];
  const allMessages = [...olderMessages, ...recentMessages];
  const pendingKickoffRef = useRef<string | null>(null);

  useEffect(() => {
    pendingKickoffRef.current = null;
  }, [conversationId]);

  useEffect(() => {
    setHasMore(messagesData?.hasMore ?? false);
  }, [messagesData?.hasMore]);

  // Action OCR / toolbar creates the user turn before ChatView mounts. Kick off
  // the assistant only after listeners are ready — same order as a follow-up send
  // (which already worked when the user "nudged" the model).
  useEffect(() => {
    if (!messagesData || sending || awaitingResponse || isStreaming || error) return;

    const messages = [...olderMessages, ...recentMessages];
    const last = messages.at(-1);
    if (!last || last.role !== 'user') return;

    const userCount = messages.filter((m) => m.role === 'user').length;
    const assistantCount = messages.filter((m) => m.role === 'assistant').length;
    if (userCount <= assistantCount) return;

    const kickoffKey = `${conversationId}:${last.id}`;
    if (pendingKickoffRef.current === kickoffKey) return;
    pendingKickoffRef.current = kickoffKey;

    setAwaitingResponse(true);
    setExpectedAssistantCount(assistantCount + 1);
    setStreamTurn((turn) => turn + 1);

    void (async () => {
      // Let React apply streamTurn so useStreaming re-subscribes before chunks.
      await new Promise<void>((resolve) => {
        window.setTimeout(resolve, 0);
      });
      try {
        const result = await rpcClient.call('conversation:start-assistant', { conversationId });
        if (!result.started) {
          setAwaitingResponse(false);
        }
      } catch (caught) {
        setAwaitingResponse(false);
        setSendError(caught instanceof Error ? caught.message : 'Failed to start reply');
      }
    })();
  }, [
    messagesData,
    olderMessages,
    recentMessages,
    conversationId,
    sending,
    awaitingResponse,
    isStreaming,
    error,
  ]);

  useEffect(() => {
    if (!isStreaming && isDone) {
      void refetch();
    }
  }, [isStreaming, isDone, refetch]);

  useEffect(() => {
    pushListener.listen();
    const unsub = pushListener.subscribe('context:updated', (payload) => {
      if (payload.conversationId === conversationId) {
        void queryClient.invalidateQueries({ queryKey: ['conversation', conversationId] });
      }
    });
    return unsub;
  }, [conversationId, queryClient]);

  useEffect(() => {
    if (isStreaming) {
      setAwaitingResponse(false);
    }
  }, [isStreaming]);

  useEffect(() => {
    if (error) {
      setAwaitingResponse(false);
    }
  }, [error]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [allMessages.length, content, isStreaming]);

  const handleLoadMore = useCallback(async () => {
    if (loadingMore || !hasMore || allMessages.length === 0) return;
    setLoadingMore(true);

    const oldest = allMessages[0];
    if (!oldest) return;

    try {
      const result = await rpcClient.call('conversation:messages', {
        conversationId,
        limit: PAGE_SIZE,
        before: oldest.createdAt,
      });
      setOlderMessages((prev) => [...result.messages, ...prev]);
      setHasMore(result.hasMore);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, allMessages, conversationId]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el || loadingMore || !hasMore) return;
    if (el.scrollTop < 40) {
      void handleLoadMore();
    }
  }, [handleLoadMore, loadingMore, hasMore]);

  const handleSend = async () => {
    if (!input.trim() || sending || isStreaming || awaitingResponse) return;
    const nextAssistantCount =
      allMessages.filter((message) => message.role === 'assistant').length + 1;
    setSending(true);
    setSendError(null);
    setAwaitingResponse(true);
    setExpectedAssistantCount(nextAssistantCount);
    setStreamTurn((turn) => turn + 1);
    try {
      await rpcClient.call('conversation:continue', {
        conversationId,
        message: input.trim(),
      });
      setInput('');
      void refetch();
    } catch (caught) {
      setAwaitingResponse(false);
      setSendError(caught instanceof Error ? caught.message : 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleAddContext = async () => {
    try {
      const pageContext = resolvePageContext
        ? await Promise.resolve(resolvePageContext())
        : await rpcClient.call('context:get', undefined, { timeoutMs: 6_000, maxRetries: 3 });
      const selection = pageContext.selection.trim();
      if (!selection) {
        setContextNotice('Сначала выделите текст на странице');
        return;
      }

      const existing = [
        contextBundle?.selection ?? '',
        ...(contextBundle?.customFragments.map((f) => f.content) ?? []),
      ];
      if (existing.some((text) => text.trim() === selection)) {
        setContextNotice('Этот текст уже в контексте');
        return;
      }

      const fragment = createContextFragment(
        `Selection ${(contextBundle?.customFragments.length ?? 0) + 1}`,
        selection,
      );

      if (onAddContext) {
        await onAddContext(fragment);
      } else {
        await rpcClient.call('conversation:add-context', { conversationId, fragment });
        void queryClient.invalidateQueries({ queryKey: ['conversation', conversationId] });
      }

      setContextNotice('Добавлено в контекст');
    } catch {
      setContextNotice('Не удалось добавить выделение');
    }
  };

  useEffect(() => {
    if (!contextNotice) return;
    const timer = window.setTimeout(() => setContextNotice(null), 2500);
    return () => window.clearTimeout(timer);
  }, [contextNotice]);

  const visibleMessages = allMessages.filter((m) => m.role !== 'system');
  const displayMessages =
    hideInitialUserMessage && visibleMessages[0]?.role === 'user'
      ? visibleMessages.slice(1)
      : visibleMessages;

  return (
    <div className={`sw-chat ${compact ? 'sw-chat-compact' : ''} ${className ?? ''}`}>
      {contextBundle && (
        <ContextChips
          bundle={contextBundle}
          onAddContext={handleAddContext}
          compact={compact}
        />
      )}
      {contextBundle?.screenshot?.dataUrl && (
        <div className="sw-screenshot-preview">
          <img src={contextBundle.screenshot.dataUrl} alt="Captured screenshot" />
        </div>
      )}
      {contextNotice && <p className="sw-context-notice">{contextNotice}</p>}

      <div className="sw-chat-messages" ref={scrollRef} onScroll={handleScroll}>
        {hasMore && (
          <button
            type="button"
            className="sw-chat-load-more"
            onClick={() => void handleLoadMore()}
            disabled={loadingMore}
          >
            {loadingMore ? 'Loading…' : 'Load older messages'}
          </button>
        )}

        {displayMessages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {isStreaming && content && (
          <div className="sw-message sw-message-assistant sw-message-streaming">
            <div className="sw-message-role">AI</div>
            <div className="sw-message-content">
              <MarkdownRenderer content={content} />
              <span className="sw-cursor" />
            </div>
          </div>
        )}

        {(awaitingResponse && !isStreaming && !error) || (isStreaming && !content && !error) ? (
          <div className="sw-chat-thinking">
            <span className="sw-dot" />
            <span className="sw-dot" />
            <span className="sw-dot" />
          </div>
        ) : null}

        {error || sendError ? (
          <ErrorDisplay
            error={error ?? sendError ?? 'Unknown error'}
            onOpenSettings={
              onOpenSettings ??
              (() => {
                const g = globalThis as typeof globalThis & {
                  chrome?: { runtime?: { openOptionsPage?: () => void } };
                };
                g.chrome?.runtime?.openOptionsPage?.();
              })
            }
            compact
          />
        ) : null}

        <div ref={bottomRef} />
      </div>

      <MessageInput
        value={input}
        onChange={setInput}
        onSend={() => void handleSend()}
        onAddContext={handleAddContext}
        disabled={sending || isStreaming || awaitingResponse}
        placeholder={inputPlaceholder}
        addContextTitle="Добавить выделенный текст на странице в контекст"
      />
    </div>
  );
}
