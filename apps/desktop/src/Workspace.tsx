import { useCallback, useEffect, useRef, useState } from 'react';
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { rpcClient } from '@/infrastructure/messaging/rpc-client';
import { useTheme } from '@/presentation/hooks/useTheme';
import { useUIStore } from '@/presentation/stores/ui.store';
import { Button } from '@/presentation/components/ui/button';
import { ChatView } from '@/presentation/components/chat/ChatView';
import { ConversationList } from '@/presentation/components/chat/ConversationList';
import type { ConversationId } from '@/domain/shared/ids';
import type { PipelineId } from '@/domain/shared/ids';
import type { PageContext } from '@/shared/types/page-context';
import { FREE_CHAT_INPUT_PLACEHOLDER } from '@/shared/constants/free-chat';
import { pageContextToBundle, PRODUCT_NAME } from '@selectmind/shared';
import { OnboardingWizard } from '@/options/OnboardingWizard';
import { SettingsPanel } from './SettingsPanel';
import { runDesktopScreenshotChat } from './capture/init-capture-hotkey';
import { runDesktopOcrToolbarFlow } from './capture/init-ocr-toolbar';
import { setDesktopActionListener } from './shell/desktop-tray-actions';
import { showMainWindowFromTray } from './shell/tray-window';
import { initDesktopHotkeys, syncDesktopHotkeys } from './shell/init-desktop-hotkeys';
import {
  formatAcceleratorDisplay,
  getHotkeyAccelerator,
  LIVE_TRANSLATE_HOTKEY_ID,
  OCR_CAPTURE_HOTKEY_ID,
  OCR_TOOLBAR_HOTKEY_ID,
  PALETTE_HOTKEY_ID,
  SELECTION_TOOLBAR_HOTKEY_ID,
  subscribeHotkeySettings,
} from './settings/desktop-hotkeys';
import type { LiveStateChangedPayload } from './live/types';
import {
  getLiveTranslateError,
  isLiveTranslateActive,
  toggleLiveTranslate,
} from './live/live-controller';
import { DesktopCommandPalette, type PaletteItem } from './shell/DesktopCommandPalette';
import { formatUnknownError } from './capture/capture-utils';
import '@/presentation/components/chat/chat.css';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

function WorkspaceInner() {
  const queryClient = useQueryClient();
  const { activeConversationId, setActiveConversation } = useUIStore();
  const [startingChat, setStartingChat] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(true);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [ocrToolbarBusy, setOcrToolbarBusy] = useState(false);
  const [liveTranslateActive, setLiveTranslateActive] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [, setHotkeyRevision] = useState(0);
  const ocrTargetRef = useRef<ConversationId | null>(null);
  const ocrBusyRef = useRef(false);
  const ocrToolbarBusyRef = useRef(false);
  const screenPickBusy = ocrBusy || ocrToolbarBusy;
  ocrTargetRef.current = showSettings ? null : activeConversationId;
  ocrBusyRef.current = ocrBusy;
  ocrToolbarBusyRef.current = ocrToolbarBusy;

  const ocrCaptureHotkey = formatAcceleratorDisplay(getHotkeyAccelerator(OCR_CAPTURE_HOTKEY_ID));
  const ocrToolbarHotkey = formatAcceleratorDisplay(getHotkeyAccelerator(OCR_TOOLBAR_HOTKEY_ID));
  const paletteHotkey = formatAcceleratorDisplay(getHotkeyAccelerator(PALETTE_HOTKEY_ID));
  const selectionToolbarHotkey = formatAcceleratorDisplay(
    getHotkeyAccelerator(SELECTION_TOOLBAR_HOTKEY_ID),
  );
  const liveTranslateHotkey = formatAcceleratorDisplay(
    getHotkeyAccelerator(LIVE_TRANSLATE_HOTKEY_ID),
  );
  const ocrButtonTitle = `OCR a screen region into chat (${ocrCaptureHotkey})`;
  const ocrToolbarButtonTitle = `OCR a screen region and open the action toolbar (${ocrToolbarHotkey})`;

  useEffect(() => subscribeHotkeySettings(() => setHotkeyRevision((value) => value + 1)), []);

  useEffect(() => {
    setLiveTranslateActive(isLiveTranslateActive());
    const unlisten = listen<LiveStateChangedPayload>('live:state-changed', (event) => {
      setLiveTranslateActive(event.payload.active);
      if (!event.payload.active) return;
      const error = getLiveTranslateError();
      if (error) setOcrError(error);
    });
    return () => {
      void unlisten.then((dispose) => dispose());
    };
  }, []);

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: () => rpcClient.call('settings:get', undefined),
  });

  const { data: providers = [] } = useQuery({
    queryKey: ['providers'],
    queryFn: () => rpcClient.call('provider:list', undefined),
  });

  useTheme(settings?.theme ?? 'dark');

  const { data: conversations = [], refetch: refetchList } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => rpcClient.call('conversation:list', { limit: 30 }),
    refetchInterval: 10_000,
  });

  const openConversation = useCallback(
    (conversationId: ConversationId) => {
      setShowSettings(false);
      setActiveConversation(conversationId);
      void refetchList();
    },
    [setActiveConversation, refetchList],
  );

  const handleOcrComplete = useCallback(
    (conversationId: string) => {
      openConversation(conversationId as ConversationId);
      void queryClient.invalidateQueries({ queryKey: ['conversations'] });
      void queryClient.invalidateQueries({ queryKey: ['conversation', conversationId] });
      void queryClient.invalidateQueries({ queryKey: ['messages', conversationId, 'recent'] });
    },
    [openConversation, queryClient],
  );

  useEffect(() => {
    void initDesktopHotkeys({
      onOcrCapture: () => {
        if (ocrBusyRef.current || ocrToolbarBusyRef.current) return;
        setOcrError(null);
        setOcrBusy(true);
        void runDesktopScreenshotChat(
          (conversationId) => {
            handleOcrComplete(conversationId);
            setOcrBusy(false);
            setOcrError(null);
          },
          (message) => {
            setOcrError(message);
            setOcrBusy(false);
          },
          { targetConversationId: ocrTargetRef.current },
        )
          .catch((error: unknown) => {
            setOcrError(formatUnknownError(error, 'Capture failed'));
            setOcrBusy(false);
          });
      },
      onOcrToolbar: () => {
        if (ocrBusyRef.current || ocrToolbarBusyRef.current) return;
        setOcrError(null);
        setOcrToolbarBusy(true);
        void runDesktopOcrToolbarFlow((message) => setOcrError(message))
          .catch((error: unknown) => {
            setOcrError(formatUnknownError(error, 'OCR toolbar failed'));
          })
          .finally(() => {
            setOcrToolbarBusy(false);
          });
      },
    }).catch((error: unknown) => {
      console.error('Failed to register desktop hotkeys:', error);
    });

    return subscribeHotkeySettings(() => {
      void syncDesktopHotkeys().catch((error: unknown) => {
        console.error('Failed to sync desktop hotkeys:', error);
      });
    });
  }, [handleOcrComplete]);

  useEffect(() => {
    setDesktopActionListener({
      onBusy: (nextBusy, kind) => {
        if (kind === 'ocr-chat') setOcrBusy(nextBusy);
        if (kind === 'ocr-toolbar') setOcrToolbarBusy(nextBusy);
        if (!nextBusy) {
          setLiveTranslateActive(isLiveTranslateActive());
          const error = getLiveTranslateError();
          if (error) setOcrError(error);
        }
      },
      onError: (message) => setOcrError(message),
      onPalette: () => {
        setShowSettings(false);
        setPaletteOpen(true);
      },
      onOcrChatComplete: (conversationId) => {
        handleOcrComplete(conversationId);
      },
    });
    return () => setDesktopActionListener({});
  }, [handleOcrComplete]);

  const handlePaletteExecute = useCallback(
    async (item: PaletteItem, context: PageContext) => {
      try {
        if (item.type === 'pipeline' && item.pipelineId) {
          const result = await rpcClient.call('pipeline:run', {
            pipelineId: item.pipelineId as PipelineId,
            context,
          });
          await rpcClient.call('conversation:promote', {
            conversationId: result.conversationId,
            mode: 'chat',
          });
          openConversation(result.conversationId);
          return;
        }

        if (item.actionId) {
          const action = await rpcClient.call('action:get', { actionId: item.actionId });
          if (!action) return;

          const result = await rpcClient.call('action:execute', {
            actionId: item.actionId,
            context,
          });

          if (action.outputMode === 'chat' || action.outputMode === 'workspace') {
            await rpcClient.call('conversation:promote', {
              conversationId: result.conversationId,
              mode: action.outputMode === 'workspace' ? 'workspace' : 'chat',
            });
          }

          openConversation(result.conversationId);
        }
      } catch (error) {
        setOcrError(formatUnknownError(error, 'Action failed'));
      }
    },
    [openConversation],
  );

  useEffect(() => {
    const unlisten = listen<{ conversationId: ConversationId }>(
      'selection:open-workspace',
      async (event) => {
        await showMainWindowFromTray(getCurrentWindow());
        openConversation(event.payload.conversationId);
      },
    );
    return () => {
      void unlisten.then((dispose) => dispose());
    };
  }, [openConversation]);

  const handleOcrCapture = useCallback(async () => {
    if (screenPickBusy) return;
    setOcrError(null);
    setOcrBusy(true);
    try {
      await runDesktopScreenshotChat(
        handleOcrComplete,
        (message) => setOcrError(message),
        { targetConversationId: ocrTargetRef.current },
      );
    } catch (error) {
      setOcrError(formatUnknownError(error, 'Capture failed'));
    } finally {
      setOcrBusy(false);
    }
  }, [screenPickBusy, handleOcrComplete]);

  const handleOcrToolbarCapture = useCallback(async () => {
    if (screenPickBusy) return;
    setOcrError(null);
    setOcrToolbarBusy(true);
    try {
      await runDesktopOcrToolbarFlow((message) => setOcrError(message));
    } catch (error) {
      setOcrError(formatUnknownError(error, 'OCR toolbar failed'));
    } finally {
      setOcrToolbarBusy(false);
    }
  }, [screenPickBusy]);

  const handleLiveTranslateToggle = useCallback(async () => {
    if (screenPickBusy) return;
    setOcrError(null);
    try {
      const active = await toggleLiveTranslate(false);
      setLiveTranslateActive(active);
      const error = getLiveTranslateError();
      if (error) {
        setOcrError(error);
        // Main may have been tucked for the scan — bring it back so the error is visible.
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        const main = getCurrentWindow();
        await main.show();
        await main.unminimize();
        await main.setFocus();
      }
    } catch (error) {
      setOcrError(formatUnknownError(error, 'Live translate failed'));
      setLiveTranslateActive(isLiveTranslateActive());
    }
  }, [screenPickBusy]);

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

  const handleNewChat = useCallback(async () => {
    if (startingChat) return;
    setShowSettings(false);
    setStartingChat(true);
    try {
      const context = await rpcClient.call('context:get', undefined);
      const { conversationId } = await rpcClient.call('conversation:create', {
        mode: 'chat',
        contextBundle: pageContextToBundle(context),
      });
      setActiveConversation(conversationId);
      void refetchList();
    } finally {
      setStartingChat(false);
    }
  }, [startingChat, setActiveConversation, refetchList]);

  const handleOpenSettings = useCallback(() => {
    setShowSettings(true);
  }, []);

  const handleBack = useCallback(() => {
    if (showSettings) {
      setShowSettings(false);
      return;
    }
    setActiveConversation(null);
  }, [showSettings, setActiveConversation]);

  const showBackButton = showSettings || !!activeConversationId;
  const needsOnboarding = showOnboarding && settings && !settings.onboardingCompleted;

  return (
    <div className="relative flex h-screen flex-col bg-background">
      {needsOnboarding ? (
        <OnboardingWizard
          providers={providers}
          variant="desktop"
          onComplete={() => setShowOnboarding(false)}
        />
      ) : null}
      <DesktopCommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onExecute={(item, context) => void handlePaletteExecute(item, context)}
      />
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">🧠</span>
          <h1 className="text-base font-semibold">{PRODUCT_NAME}</h1>
          <span className="rounded bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
            Desktop
          </span>
        </div>
        <div className="flex items-center gap-2">
          {showBackButton && (
            <Button variant="ghost" size="sm" onClick={handleBack}>
              ← Back
            </Button>
          )}
          {!showSettings && (
            <>
              <Button
                variant="outline"
                size="sm"
                title={`Search actions and pipelines (${paletteHotkey})`}
                disabled={startingChat || screenPickBusy}
                onClick={() => setPaletteOpen(true)}
              >
                Palette
              </Button>
              <Button
                variant={liveTranslateActive ? 'secondary' : 'outline'}
                size="sm"
                title={
                  liveTranslateActive
                    ? `Clear translation overlay (${liveTranslateHotkey})`
                    : `Translate screen once (${liveTranslateHotkey})`
                }
                disabled={screenPickBusy || startingChat}
                onClick={() => void handleLiveTranslateToggle()}
              >
                {liveTranslateActive ? '⏹ Clear translate' : '🎮 Translate'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                title={ocrToolbarButtonTitle}
                disabled={screenPickBusy || startingChat}
                onClick={() => void handleOcrToolbarCapture()}
              >
                {ocrToolbarBusy ? '…' : '🔤 OCR toolbar'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                title={ocrButtonTitle}
                disabled={screenPickBusy || startingChat}
                onClick={() => void handleOcrCapture()}
              >
                {ocrBusy ? '…' : '📸 OCR chat'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={startingChat || screenPickBusy}
                onClick={() => void handleNewChat()}
              >
                {startingChat ? '…' : 'New chat'}
              </Button>
            </>
          )}
          <Button
            variant={showSettings ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => (showSettings ? setShowSettings(false) : handleOpenSettings())}
          >
            Settings
          </Button>
        </div>
      </header>

      <main className="relative flex flex-1 overflow-hidden">
        {ocrError ? (
          <p className="absolute left-4 right-4 top-2 z-20 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            {ocrError}
          </p>
        ) : null}
        {showSettings ? (
          <SettingsPanel />
        ) : !activeConversationId ? (
          <div className="flex flex-1 flex-col">
            <div className="flex items-center justify-between border-b border-border px-4 py-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Recent Conversations
              </p>
              {conversations.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-muted-foreground hover:text-red-400"
                  disabled={clearAllMutation.isPending}
                  onClick={handleClearAllConversations}
                >
                  {clearAllMutation.isPending ? 'Clearing…' : 'Clear all'}
                </Button>
              )}
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {conversations.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
                  <span className="text-4xl">✨</span>
                  <div>
                    <p className="font-medium">Desktop workspace ready</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Start a chat, then configure an AI provider in Settings.
                    </p>
                  </div>
                  <Button variant="outline" disabled={startingChat} onClick={() => void handleNewChat()}>
                    {startingChat ? 'Starting…' : 'Start free chat'}
                  </Button>
                  <Button
                    variant="outline"
                    disabled={startingChat || screenPickBusy}
                    onClick={() => void handleOcrToolbarCapture()}
                  >
                    {ocrToolbarBusy ? 'Selecting area…' : '🔤 OCR toolbar'}
                  </Button>
                  <Button
                    variant="outline"
                    disabled={startingChat || screenPickBusy}
                    onClick={() => void handleOcrCapture()}
                  >
                    {ocrBusy ? 'Selecting area…' : '📸 OCR chat'}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    OCR chat:{' '}
                    <kbd className="rounded border border-border px-1.5 py-0.5">{ocrCaptureHotkey}</kbd>
                    {' · '}
                    OCR toolbar:{' '}
                    <kbd className="rounded border border-border px-1.5 py-0.5">{ocrToolbarHotkey}</kbd>
                    {' · '}
                    Palette:{' '}
                    <kbd className="rounded border border-border px-1.5 py-0.5">{paletteHotkey}</kbd>
                    {' · '}
                    Toolbar anywhere:{' '}
                    <kbd className="rounded border border-border px-1.5 py-0.5">
                      {selectionToolbarHotkey}
                    </kbd>
                  </p>
                  <Button variant="ghost" size="sm" onClick={handleOpenSettings}>
                    Open Settings →
                  </Button>
                </div>
              ) : (
                <ConversationList
                  conversations={conversations}
                  activeId={null}
                  onSelect={(id: ConversationId) => setActiveConversation(id)}
                />
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-1 flex-col overflow-hidden p-4">
            {conversation?.contextBundle.pageTitle ? (
              <p className="mb-2 truncate text-xs text-muted-foreground">
                📄 {conversation.contextBundle.pageTitle}
              </p>
            ) : null}
            <div className="flex flex-1 flex-col overflow-hidden">
              <ChatView
                conversationId={activeConversationId}
                inputPlaceholder={FREE_CHAT_INPUT_PLACEHOLDER}
                onOpenSettings={handleOpenSettings}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export function Workspace() {
  return (
    <QueryClientProvider client={queryClient}>
      <WorkspaceInner />
    </QueryClientProvider>
  );
}
