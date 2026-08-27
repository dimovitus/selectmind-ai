import { useCallback, useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { rpcClient } from '@/infrastructure/messaging/rpc-client';
import { useTheme } from '@/presentation/hooks/useTheme';
import { useUIStore } from '@/presentation/stores/ui.store';
import { Button } from '@/presentation/components/ui/button';
import { PRODUCT_NAME } from '@/shared/constants/brand';
import { ChatView } from '@/presentation/components/chat/ChatView';
import { ConversationList } from '@/presentation/components/chat/ConversationList';
import type { ConversationId } from '@/domain/shared/ids';
import '@/presentation/components/chat/chat.css';

const OCR_BUTTON_LABEL = 'OCR';
const OCR_BUTTON_TITLE = 'Capture a screen region and explain it with AI (Ctrl+Shift+X)';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

function Workspace() {
  const queryClient = useQueryClient();
  const { activeConversationId, setActiveConversation } = useUIStore();
  const [ocrBusy, setOcrBusy] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: () => rpcClient.call('settings:get', undefined),
  });

  useTheme(settings?.theme ?? 'dark');

  const { data: conversations = [], refetch: refetchList } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => rpcClient.call('conversation:list', { limit: 30 }),
    refetchInterval: 10_000,
  });

  const clearAllMutation = useMutation({
    mutationFn: () => rpcClient.call('conversation:clear-all', undefined),
    onSuccess: () => {
      setActiveConversation(null);
      void queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });

  const handleClearAllConversations = () => {
    if (conversations.length === 0 || clearAllMutation.isPending) return;
    const confirmed = window.confirm(
      'Delete all conversations? This will permanently remove your chat history.',
    );
    if (!confirmed) return;
    clearAllMutation.mutate();
  };

  const { data: conversation } = useQuery({
    queryKey: ['conversation', activeConversationId],
    queryFn: () =>
      activeConversationId
        ? rpcClient.call('conversation:get', { conversationId: activeConversationId })
        : null,
    enabled: !!activeConversationId,
  });

  useEffect(() => {
    const listener = (message: unknown) => {
      if (typeof message !== 'object' || message === null) return;
      const msg = message as Record<string, unknown>;
      if (msg.type === 'saywa:open-sidepanel' && typeof msg.conversationId === 'string') {
        const id = msg.conversationId as ConversationId;
        setActiveConversation(id);
        setOcrBusy(false);
        setOcrError(null);
        void rpcClient
          .call('conversation:promote', { conversationId: id, mode: 'chat' })
          .catch(() => {});
        void refetchList();
      }
      if (msg.type === 'saywa:capture-screen:finished') {
        setOcrBusy(false);
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, [setActiveConversation, refetchList]);

  const handleOcrCapture = useCallback(async () => {
    if (ocrBusy) return;

    setOcrError(null);
    setOcrBusy(true);

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) {
        setOcrError('No active tab');
        setOcrBusy(false);
        return;
      }

      if (
        tab.url?.startsWith('chrome://') ||
        tab.url?.startsWith('chrome-extension://') ||
        tab.url?.startsWith('edge://')
      ) {
        setOcrError('OCR works on regular web pages only');
        setOcrBusy(false);
        return;
      }

      await chrome.tabs.sendMessage(tab.id, { type: 'saywa:capture-screen', target: 'sidebar' });
    } catch {
      setOcrError('Reload the page, then try OCR again');
      setOcrBusy(false);
    }
  }, [ocrBusy]);

  return (
    <div className="relative flex h-screen flex-col bg-background">
      <header className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">🧠</span>
          <h1 className="text-base font-semibold">{PRODUCT_NAME}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            title={OCR_BUTTON_TITLE}
            disabled={ocrBusy}
            onClick={() => void handleOcrCapture()}
          >
            {ocrBusy ? '…' : '📸'} {OCR_BUTTON_LABEL}
          </Button>
          {activeConversationId && (
            <Button variant="ghost" size="sm" onClick={() => setActiveConversation(null)}>
              ← Back
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => void chrome.runtime.openOptionsPage()}>
            Settings
          </Button>
        </div>
      </header>

      <main className="flex flex-1 overflow-hidden">
        {ocrError && (
          <p className="absolute left-4 right-4 top-16 z-10 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {ocrError}
          </p>
        )}
        {!activeConversationId ? (
          <div className="flex flex-1 flex-col">
            <div className="flex items-center justify-between border-b px-4 py-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Recent Conversations
              </p>
              {conversations.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-muted-foreground hover:text-destructive"
                  disabled={clearAllMutation.isPending}
                  onClick={handleClearAllConversations}
                >
                  {clearAllMutation.isPending ? 'Clearing…' : 'Clear all conversations'}
                </Button>
              )}
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {conversations.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-4 text-center p-8">
                  <span className="text-4xl">✨</span>
                  <div>
                    <p className="font-medium">Workspace ready</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Select text on any page, or capture a screen region with OCR.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    disabled={ocrBusy}
                    title={OCR_BUTTON_TITLE}
                    onClick={() => void handleOcrCapture()}
                  >
                    {ocrBusy ? 'Selecting area…' : '📸 Capture screen (OCR)'}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    <kbd className="rounded border px-1.5 py-0.5">Ctrl+Shift+S</kbd> toggle panel ·{' '}
                    <kbd className="rounded border px-1.5 py-0.5">Ctrl+Shift+X</kbd> OCR hotkey
                  </p>
                </div>
              ) : (
                <ConversationList
                  conversations={conversations}
                  activeId={null}
                  onSelect={setActiveConversation}
                />
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-1 flex-col overflow-hidden p-4">
            {conversation?.contextBundle.pageTitle && (
              <p className="mb-2 truncate text-xs text-muted-foreground">
                📄 {conversation.contextBundle.pageTitle}
              </p>
            )}
            <div className="flex flex-1 flex-col overflow-hidden">
              <ChatView conversationId={activeConversationId} />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Workspace />
    </QueryClientProvider>
  );
}
