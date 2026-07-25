import { useState, useCallback, useEffect, useRef } from 'react';
import { AnimatePresence } from 'framer-motion';
import type { Action } from '@/domain/action/action.schema';
import type { ConversationId } from '@/domain/shared/ids';
import type { PageContext } from '@/shared/types/page-context';
import { pageContextToBundle } from '@/shared/types/page-context';
import { FREE_CHAT_ACTION } from '@/shared/constants/free-chat';
import { SCREENSHOT_ACTION_ID } from '@/shared/constants/screenshot-action';
import { buildScreenshotPageContext, runScreenCaptureFlow } from '../screen-capture/run-capture-flow';
import { rpcClient, pushListener } from '@/infrastructure/messaging/rpc-client';
import { initSelectionListener, setSelectionHandler, setSelectionClearHandler, destroySelectionListener } from '../selection-listener';
import { initHotkeyListener, destroyHotkeyListener, setHotkeyHandler } from '../hotkey-listener';
import { mountContentUI } from './mount';
import { FloatingToolbar } from './FloatingToolbar';
import { QuickActionPopup } from './QuickActionPopup';
import { ChatPopup, chatStyles } from './ChatPopup';
import { CommandPalette } from './CommandPalette';
import type { SelectionRect } from '../selection-rect';
import { getSelectionRect, captureRect } from '../selection-rect';
import { rememberPageSelection } from '../page-context-extractor';
import contentStyles from './content.css?inline';

interface ActivePopup {
  action: Action;
  conversationId: ConversationId;
  rect: SelectionRect;
  mode: 'quick' | 'chat';
}

function ContentApp() {
  const [toolbar, setToolbar] = useState<{ context: PageContext; rect: SelectionRect } | null>(null);
  const [popup, setPopup] = useState<ActivePopup | null>(null);
  const [showToolbar, setShowToolbar] = useState(true);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const lastSelectionRef = useRef('');
  const captureInProgressRef = useRef(false);
  const saveConversationHistoryRef = useRef(true);

  useEffect(() => {
    pushListener.listen();
    void rpcClient
      .call('ping', undefined, { timeoutMs: 3_000, maxRetries: 2, retryDelayMs: 200 })
      .catch(() => {});
  }, []);

  useEffect(() => {
    void rpcClient.call('settings:get', undefined).then((s) => {
      setShowToolbar(s.showFloatingToolbar);
      saveConversationHistoryRef.current = s.saveConversationHistory;
    });
  }, []);

  const closePopup = useCallback((conversationId: ConversationId) => {
    setPopup(null);
    if (saveConversationHistoryRef.current) return;
    void rpcClient.call('conversation:delete', { conversationId }).catch(() => {});
  }, []);

  const handleOpenWorkspace = useCallback((conversationId: string) => {
    void chrome.runtime.sendMessage({
      type: 'saywa:open-sidepanel',
      conversationId,
    });
    setToolbar(null);
    setPopup(null);
    setPaletteOpen(false);
  }, []);

  const handleActionResult = useCallback(
    (action: Action, conversationId: ConversationId, rect: SelectionRect) => {
      if (action.outputMode === 'clipboard') {
        void rpcClient.call('conversation:messages', { conversationId }).then(({ messages }) => {
          const last = messages.filter((m) => m.role === 'assistant').pop();
          if (last) void navigator.clipboard.writeText(last.content);
        });
        return;
      }
      if (action.outputMode === 'popup') {
        setPopup({ action, conversationId, rect, mode: 'quick' });
        setToolbar(null);
      } else if (action.outputMode === 'chat') {
        setPopup({ action, conversationId, rect, mode: 'chat' });
        setToolbar(null);
      } else if (action.outputMode === 'workspace') {
        void rpcClient.call('conversation:promote', { conversationId, mode: 'workspace' });
        handleOpenWorkspace(conversationId);
      }
    },
    [handleOpenWorkspace],
  );

  const openScreenshotChat = useCallback(async (options?: { target?: 'sidebar' | 'popup' }) => {
    if (captureInProgressRef.current) return;

    const target = options?.target ?? 'sidebar';
    captureInProgressRef.current = true;
    setToolbar(null);
    setPaletteOpen(false);

    try {
      const screenshot = await runScreenCaptureFlow();
      if (!screenshot) return;

      const action = await rpcClient.call('action:get', { actionId: SCREENSHOT_ACTION_ID });
      if (!action) return;

      const context = await buildScreenshotPageContext(screenshot);
      const result = await rpcClient.call('action:execute', { actionId: action.id, context });

      if (target === 'sidebar') {
        await rpcClient.call('conversation:promote', {
          conversationId: result.conversationId,
          mode: 'chat',
        });
        handleOpenWorkspace(result.conversationId);
        return;
      }

      const rect = captureRect(
        new DOMRect(
          window.innerWidth / 2 - Math.min(220, screenshot.width / 2),
          window.innerHeight / 3,
          screenshot.width,
          screenshot.height,
        ),
      );
      handleActionResult(action, result.conversationId, rect);
    } finally {
      captureInProgressRef.current = false;
      void chrome.runtime.sendMessage({ type: 'saywa:capture-screen:finished' }).catch(() => {});
    }
  }, [handleActionResult, handleOpenWorkspace]);

  const runAction = useCallback(
    async (action: Action, context: PageContext) => {
      if (action.id === SCREENSHOT_ACTION_ID) {
        await openScreenshotChat({ target: 'sidebar' });
        return;
      }

      const rect = getSelectionRect() ?? captureRect(new DOMRect(window.innerWidth / 2 - 160, window.innerHeight / 3, 0, 0));
      const result = await rpcClient.call('action:execute', { actionId: action.id, context });
      handleActionResult(action, result.conversationId, rect);
    },
    [handleActionResult, openScreenshotChat],
  );

  const openFreeChat = useCallback(
    async (context: PageContext, rect: SelectionRect) => {
      rememberPageSelection(context.selection);
      const { conversationId } = await rpcClient.call('conversation:create', {
        mode: 'chat',
        contextBundle: pageContextToBundle(context),
      });
      setPopup({
        action: FREE_CHAT_ACTION as Action,
        conversationId,
        rect,
        mode: 'chat',
      });
      setToolbar(null);
    },
    [],
  );

  const handlePaletteExecute = useCallback(
    async (
      item: { type: string; actionId?: Action['id']; pipelineId?: string },
      context: PageContext,
    ) => {
      const rect = getSelectionRect() ?? captureRect(new DOMRect(window.innerWidth / 2 - 160, window.innerHeight / 3, 0, 0));

      if (item.type === 'pipeline' && item.pipelineId) {
        const result = await rpcClient.call('pipeline:run', {
          pipelineId: item.pipelineId as import('@/domain/shared/ids').PipelineId,
          context,
        });
        setPopup({
          action: { icon: '🔗', name: 'Pipeline', outputMode: 'popup' } as Action,
          conversationId: result.conversationId,
          rect,
          mode: 'quick',
        });
        setToolbar(null);
        return;
      }

      if (item.actionId) {
        const action = await rpcClient.call('action:get', { actionId: item.actionId });
        if (action) await runAction(action, context);
      }
    },
    [runAction],
  );

  useEffect(() => {
    const listener = (message: unknown) => {
      if (typeof message !== 'object' || message === null) return;
      const msg = message as Record<string, unknown>;
      if (msg.type === 'saywa:open-palette') {
        setPaletteOpen(true);
        setToolbar(null);
        return;
      }
      if (msg.type === 'saywa:capture-screen') {
        const target = msg.target === 'popup' ? 'popup' : 'sidebar';
        void openScreenshotChat({ target });
        return;
      }
      if (msg.type === 'saywa:context-menu-action' && typeof msg.actionId === 'string') {
        const context = msg.context as PageContext | undefined;
        if (context?.selection) {
          rememberPageSelection(context.selection);
        }
        void (async () => {
          const action = await rpcClient.call('action:get', {
            actionId: msg.actionId as Action['id'],
          });
          if (!action) return;
          const pageContext =
            context ??
            ({
              selection: '',
              pageTitle: document.title,
              url: window.location.href,
              hostname: window.location.hostname,
              language: navigator.language,
              date: new Date().toLocaleDateString(),
              time: new Date().toLocaleTimeString(),
            } satisfies PageContext);
          await runAction(action, pageContext);
        })();
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, [runAction, openScreenshotChat]);

  useEffect(() => {
    setHotkeyHandler((action, context) => {
      void runAction(action, context);
    });
    initHotkeyListener();
    return () => {
      destroyHotkeyListener();
      setHotkeyHandler(null);
    };
  }, [runAction]);

  useEffect(() => {
    if (!showToolbar) return;

    setSelectionHandler((context, rect) => {
      const sel = context.selection.trim();
      // Ignore duplicate selection events (e.g. after clicking toolbar — same text still selected)
      if (sel === lastSelectionRef.current) return;

      lastSelectionRef.current = sel;
      setToolbar({ context, rect });
      setPopup(null);
      setPaletteOpen(false);
    });
    setSelectionClearHandler(() => {
      // Keep toolbar open — clicking an action collapses the browser selection
      lastSelectionRef.current = '';
    });
    initSelectionListener();
    return () => {
      destroySelectionListener();
      setSelectionHandler(null);
      setSelectionClearHandler(null);
    };
  }, [showToolbar]);

  return (
    <>
      {toolbar && (
        <FloatingToolbar
          context={toolbar.context}
          rect={toolbar.rect}
          onClose={() => setToolbar(null)}
          onActionResult={handleActionResult}
          onOpenFreeChat={(context, rect) => void openFreeChat(context, rect)}
        />
      )}
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onExecute={(item, context) => void handlePaletteExecute(item, context)}
      />
      <AnimatePresence>
        {popup?.mode === 'quick' && (
          <QuickActionPopup
            key={popup.conversationId}
            action={popup.action}
            conversationId={popup.conversationId}
            rect={popup.rect}
            onClose={() => closePopup(popup.conversationId)}
            onContinueChat={() => {
              void rpcClient
                .call('conversation:promote', { conversationId: popup.conversationId, mode: 'chat' })
                .then(() => handleOpenWorkspace(popup.conversationId));
            }}
          />
        )}
        {popup?.mode === 'chat' && (
          <ChatPopup
            key={popup.conversationId}
            action={popup.action}
            conversationId={popup.conversationId}
            rect={popup.rect}
            onClose={() => closePopup(popup.conversationId)}
            onOpenWorkspace={() => handleOpenWorkspace(popup.conversationId)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

export function initContentUI(): void {
  mountContentUI(<ContentApp />, contentStyles + '\n' + chatStyles);
}
