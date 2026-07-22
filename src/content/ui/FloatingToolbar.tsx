import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Action } from '@/domain/action/action.schema';
import type { ActionId, ConversationId } from '@/domain/shared/ids';
import type { PageContext } from '@/shared/types/page-context';
import { getDefaultToolbarActions } from '@/shared/constants/default-actions';
import { LOG_PREFIX } from '@/shared/constants/brand';
import { rpcClient, type RpcCallOptions } from '@/infrastructure/messaging/rpc-client';
import { rememberPageSelection } from '@/content/page-context-extractor';
import type { SelectionRect } from '../selection-rect';
import { getSelectionRect } from '../selection-rect';
import { toolbarPositionStyle } from './mount';

interface FloatingToolbarProps {
  context: PageContext;
  rect: SelectionRect;
  onClose: () => void;
  onActionResult: (action: Action, conversationId: ConversationId, rect: SelectionRect) => void;
}

const TOOLBAR_RPC: RpcCallOptions = {
  timeoutMs: 6_000,
  maxRetries: 5,
  retryDelayMs: 250,
};

async function loadToolbarActions(): Promise<Action[]> {
  const toolbar = await rpcClient.call('action:toolbar', undefined, TOOLBAR_RPC);
  if (toolbar.length > 0) return toolbar;

  const all = await rpcClient.call('action:list', undefined, TOOLBAR_RPC);
  const enabled = all.filter((a) => a.isEnabled).sort((a, b) => a.order - b.order);
  if (enabled.length > 0) return enabled.slice(0, 7);

  throw new Error('No actions available');
}

function getLoadErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes('Extension context invalidated') || message.includes('context invalidated')) {
    return 'Extension was reloaded. Refresh this page (F5), then try again.';
  }
  if (
    message.includes('Receiving end does not exist') ||
    message.includes('Could not establish connection')
  ) {
    return 'Background unavailable. Reload the extension, then refresh this page (F5).';
  }
  return 'Could not sync toolbar actions. Built-in actions still work.';
}

export function FloatingToolbar({ context, rect, onClose, onActionResult }: FloatingToolbarProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [actions, setActions] = useState<Action[]>(() => getDefaultToolbarActions());
  const [syncError, setSyncError] = useState<string | null>(null);
  const [runningId, setRunningId] = useState<ActionId | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const busyRef = useRef(false);

  const refreshActions = useCallback(async () => {
    try {
      const loaded = await loadToolbarActions();
      setActions(loaded);
      setSyncError(null);
    } catch (error) {
      console.error(`${LOG_PREFIX} Failed to sync toolbar actions:`, error);
      setSyncError(getLoadErrorMessage(error));
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function sync(retry = 0): Promise<void> {
      try {
        const loaded = await loadToolbarActions();
        if (cancelled) return;
        setActions(loaded);
        setSyncError(null);
      } catch (error) {
        if (cancelled) return;
        if (retry < 4) {
          await new Promise((r) => setTimeout(r, 300 * (retry + 1)));
          return sync(retry + 1);
        }
        console.error(`${LOG_PREFIX} Failed to sync toolbar actions:`, error);
        setSyncError(getLoadErrorMessage(error));
      }
    }

    void sync();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleAction = useCallback(
    async (action: Action) => {
      if (busyRef.current) return;
      busyRef.current = true;
      setActionError(null);
      setRunningId(action.id);
      try {
        rememberPageSelection(context.selection);
        const result = await rpcClient.call('action:execute', {
          actionId: action.id,
          context,
        });
        const anchor = getSelectionRect() ?? rect;
        onActionResult(action, result.conversationId, anchor);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Action failed';
        console.error(`${LOG_PREFIX} Action failed:`, error);
        setActionError(message);
      } finally {
        setRunningId(null);
        busyRef.current = false;
      }
    },
    [context, onActionResult, rect],
  );

  const runActionOnPress = useCallback(
    (action: Action, event: React.MouseEvent | React.PointerEvent) => {
      event.preventDefault();
      event.stopPropagation();
      void handleAction(action);
    },
    [handleAction],
  );

  return (
    <AnimatePresence>
      <motion.div
        ref={ref}
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.15, ease: 'easeOut' }}
        style={toolbarPositionStyle(rect)}
        className="saywa-toolbar"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="saywa-toolbar-inner">
          {actions.map((action) => (
            <button
              key={action.id}
              type="button"
              className="saywa-toolbar-btn"
              title={action.name}
              disabled={runningId === action.id}
              onMouseDown={(e) => runActionOnPress(action, e)}
            >
              <span className="saywa-toolbar-icon">{action.icon}</span>
            </button>
          ))}

          {syncError && (
            <button
              type="button"
              className="saywa-toolbar-btn"
              title="Retry syncing actions"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                void refreshActions();
              }}
            >
              <span className="saywa-toolbar-icon">↻</span>
            </button>
          )}

          <span className="saywa-toolbar-sep" />
          <button
            type="button"
            className="saywa-toolbar-btn saywa-toolbar-close"
            title="Close"
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
          >
            <span className="saywa-toolbar-icon">×</span>
          </button>
        </div>
        {actionError && <p className="saywa-toolbar-error">{actionError}</p>}
        {syncError && !actionError && <p className="saywa-toolbar-error">{syncError}</p>}
      </motion.div>
    </AnimatePresence>
  );
}
