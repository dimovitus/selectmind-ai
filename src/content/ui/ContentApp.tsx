import { useState, useCallback, useEffect, useRef } from 'react';
import { AnimatePresence } from 'framer-motion';
import type { Action } from '@/domain/action/action.schema';
import type { ConversationId } from '@/domain/shared/ids';
import type { PageContext } from '@/shared/types/page-context';
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

  useEffect(() => {
    pushListener.listen();
    void rpcClient
      .call('ping', undefined, { timeoutMs: 3_000, maxRetries: 2, retryDelayMs: 200 })
      .catch(() => {});
  }, []);

  useEffect(() => {
    void rpcClient.call('settings:get', undefined).then((s) => {
      setShowToolbar(s.showFloatingToolbar);
    });
  }, []);

  useEffect(() => {
    const listener = (message: unknown) => {
      if (typeof message !== 'object' || message === null) return;
      const msg = message as Record<string, unknown>;
      if (msg.type === 'saywa:open-palette') {
        setPaletteOpen(true);
        setToolbar(null);
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
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

  const runAction = useCallback(
    async (action: Action, context: PageContext) => {
      const rect = getSelectionRect() ?? captureRect(new DOMRect(window.innerWidth / 2 - 160, window.innerHeight / 3, 0, 0));
      const result = await rpcClient.call('action:execute', { actionId: action.id, context });
      handleActionResult(action, result.conversationId, rect);
    },
    [handleActionResult],
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
            onClose={() => setPopup(null)}
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
            onClose={() => setPopup(null)}
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
