import { useCallback, useEffect, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { emit, listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import type { Action } from '@/domain/action/action.schema';
import type { ActionId, ConversationId } from '@/domain/shared/ids';
import type { PageContext } from '@/shared/types/page-context';
import { pageContextToBundle } from '@/shared/types/page-context';
import { getDefaultToolbarActions } from '@/shared/constants/default-actions';
import { FREE_CHAT_ACTION, FREE_CHAT_INPUT_PLACEHOLDER } from '@/shared/constants/free-chat';
import { rpcClient, pushListener } from '@/infrastructure/messaging/rpc-client';
import { ChatView } from '@/presentation/components/chat/ChatView';
import { initDesktopApp } from '../di/container';
import { buildSelectionPageContext } from './build-context';
import { dismissSelectionOverlay } from './overlay-manager';
import {
  getPopupPosition,
  popupScreenBounds,
  popupPositionStyle,
  toolbarScreenBounds,
} from './positioning';
import {
  POPUP_DEFAULT_HEIGHT,
  POPUP_DEFAULT_WIDTH,
  useClickOutside,
  useKeyboardIsolation,
  usePopupDrag,
  useResizablePopup,
} from './popup-hooks';
import type { OverlayMonitor, SelectionRect, SelectionSnapshot } from './types';
import { snapshotToRect } from './types';
import '@/presentation/components/chat/chat.css';
import './overlay.css';

const queryClient = new QueryClient();
/** Ignore stray mouse-up from region picking that would click a toolbar button. */
const TOOLBAR_CLICK_GRACE_MS = 450;

interface ActivePopup {
  action: Action;
  conversationId: ConversationId;
}

interface OverlayPayload {
  snapshot: SelectionSnapshot;
  monitor: OverlayMonitor;
}

async function loadToolbarActions(): Promise<Action[]> {
  const toolbar = await rpcClient.call('action:toolbar', undefined);
  if (toolbar.length > 0) return toolbar;

  const all = await rpcClient.call('action:list', undefined);
  const enabled = all.filter((action) => action.isEnabled).sort((a, b) => a.order - b.order);
  if (enabled.length > 0) return enabled;

  throw new Error('No actions available');
}

function SelectionOverlayInner() {
  const [dbReady, setDbReady] = useState(false);
  const [rect, setRect] = useState<SelectionRect | null>(null);
  const [context, setContext] = useState<PageContext | null>(null);
  const [showToolbar, setShowToolbar] = useState(false);
  const [popup, setPopup] = useState<ActivePopup | null>(null);
  const [actions, setActions] = useState<Action[]>(() => getDefaultToolbarActions());
  const [runningId, setRunningId] = useState<ActionId | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [saveHistory, setSaveHistory] = useState(true);
  const [toolbarReady, setToolbarReady] = useState(false);
  const busyRef = useRef(false);
  const popupRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const toolbarGraceTimerRef = useRef<number | null>(null);
  const popupStateRef = useRef<ActivePopup | null>(null);
  const cachedContextRef = useRef<PageContext | null>(null);
  const cachedRectRef = useRef<SelectionRect | null>(null);
  const cachedMonitorRef = useRef<OverlayMonitor | null>(null);
  const lastSelectionRef = useRef('');
  const showToolbarRef = useRef(false);

  popupStateRef.current = popup;
  showToolbarRef.current = showToolbar;

  const armToolbarGrace = useCallback(() => {
    setToolbarReady(false);
    if (toolbarGraceTimerRef.current !== null) {
      window.clearTimeout(toolbarGraceTimerRef.current);
    }
    toolbarGraceTimerRef.current = window.setTimeout(() => {
      setToolbarReady(true);
      toolbarGraceTimerRef.current = null;
    }, TOOLBAR_CLICK_GRACE_MS);
  }, []);

  useEffect(() => {
    return () => {
      if (toolbarGraceTimerRef.current !== null) {
        window.clearTimeout(toolbarGraceTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    document.documentElement.classList.add('selection-overlay');
    let cancelled = false;

    const unlistenShow = listen<OverlayPayload>('selection:show', (event) => {
      const { snapshot, monitor } = event.payload;
      const text = snapshot.text.trim();
      // The backend re-emits the same payload while the webview boots.
      if (text === lastSelectionRef.current && showToolbarRef.current) return;
      lastSelectionRef.current = text;

      const nextRect = snapshotToRect(snapshot, monitor);
      const nextContext = buildSelectionPageContext(snapshot);
      cachedContextRef.current = nextContext;
      cachedRectRef.current = nextRect;
      cachedMonitorRef.current = monitor;
      setPopup(null);
      setRect(nextRect);
      setContext(nextContext);
      setShowToolbar(true);
      setActionError(null);
      armToolbarGrace();
    });

    const unlistenHide = listen('selection:hide', () => {
      if (!popupStateRef.current) {
        lastSelectionRef.current = '';
        setShowToolbar(false);
        setRect(null);
        setContext(null);
      }
    });

    const unlistenPing = listen('selection:overlay-ping', () => {
      void emit('selection:overlay-ready', {});
    });

    void Promise.all([unlistenShow, unlistenHide, unlistenPing]).then(() => {
      if (!cancelled) void emit('selection:overlay-ready', {});
    });

    return () => {
      cancelled = true;
      document.documentElement.classList.remove('selection-overlay');
      void unlistenShow.then((unlisten) => unlisten());
      void unlistenHide.then((unlisten) => unlisten());
      void unlistenPing.then((unlisten) => unlisten());
    };
  }, [armToolbarGrace]);

  useEffect(() => {
    if (!dbReady) return;
    let cancelled = false;

    async function sync(retry = 0): Promise<void> {
      try {
        const loaded = await loadToolbarActions();
        if (cancelled) return;
        setActions(loaded);
      } catch (error) {
        if (cancelled) return;
        if (retry < 4) {
          await new Promise((resolve) => setTimeout(resolve, 300 * (retry + 1)));
          return sync(retry + 1);
        }
        console.error('[selectmind] Failed to sync toolbar actions:', error);
        setActions(getDefaultToolbarActions());
      }
    }

    void sync();
    return () => {
      cancelled = true;
    };
  }, [dbReady]);

  useEffect(() => {
    let cancelled = false;

    // The main window seeds the same SQLite file, so the first attempt here can
    // lose a race. Without retries every toolbar button stays disabled forever.
    async function bootstrap(attempt = 0): Promise<void> {
      try {
        await initDesktopApp();
        pushListener.listen();
        const settings = await rpcClient.call('settings:get', undefined);
        if (cancelled) return;
        setSaveHistory(settings.saveConversationHistory);
        setDbReady(true);
        setActionError(null);
      } catch (error) {
        if (cancelled) return;
        console.error('[selectmind] Selection overlay bootstrap failed:', error);
        if (attempt < 5) {
          await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
          if (cancelled) return;
          return bootstrap(attempt + 1);
        }
        setActionError(
          error instanceof Error ? `Storage unavailable: ${error.message}` : 'Storage unavailable',
        );
      }
    }

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  const setOverlayBusy = useCallback(async (busy: boolean) => {
    await emit(busy ? 'selection:overlay-busy' : 'selection:overlay-idle', {});
  }, []);

  const closePopup = useCallback(
    (conversationId: ConversationId) => {
      setPopup(null);
      void setOverlayBusy(false);
      if (!saveHistory) {
        void rpcClient.call('conversation:delete', { conversationId }).catch(() => {});
      }
      void dismissSelectionOverlay();
    },
    [saveHistory, setOverlayBusy],
  );

  const openPopup = useCallback(
    async (action: Action, conversationId: ConversationId) => {
      setShowToolbar(false);
      setPopup({ action, conversationId });
      await setOverlayBusy(true);

      const monitor = cachedMonitorRef.current;
      const selectionRect = cachedRectRef.current;
      if (monitor && selectionRect) {
        // Size the native window to the chat card — never the full monitor.
        // A full-monitor opaque window is the black slab users report as a bug.
        await emit('selection:overlay-resize', popupScreenBounds(selectionRect, monitor));
      }

      await getCurrentWindow().setFocus();
    },
    [setOverlayBusy],
  );

  const handleActionResult = useCallback(
    async (action: Action, conversationId: ConversationId) => {
      if (action.outputMode === 'clipboard') {
        const { messages } = await rpcClient.call('conversation:messages', { conversationId });
        const last = messages.filter((m) => m.role === 'assistant').pop();
        if (last) await navigator.clipboard.writeText(last.content);
        void dismissSelectionOverlay();
        return;
      }

      if (action.outputMode === 'popup' || action.outputMode === 'chat') {
        await openPopup(action, conversationId);
        return;
      }

      if (action.outputMode === 'workspace') {
        await rpcClient.call('conversation:promote', { conversationId, mode: 'workspace' });
        await emit('selection:open-workspace', { conversationId });
        void dismissSelectionOverlay();
      }
    },
    [openPopup],
  );

  const runAction = useCallback(
    async (action: Action) => {
      if (busyRef.current || !context || !dbReady || !toolbarReady) return;
      busyRef.current = true;
      setActionError(null);
      setRunningId(action.id);
      try {
        const result = await rpcClient.call('action:execute', {
          actionId: action.id,
          context,
        });
        await handleActionResult(action, result.conversationId);
      } catch (error) {
        setActionError(error instanceof Error ? error.message : 'Action failed');
      } finally {
        setRunningId(null);
        busyRef.current = false;
      }
    },
    [context, dbReady, handleActionResult, toolbarReady],
  );

  const openFreeChat = useCallback(async () => {
    if (!context || !rect || !dbReady || !toolbarReady) return;
    const { conversationId } = await rpcClient.call('conversation:create', {
      mode: 'chat',
      contextBundle: pageContextToBundle(context),
    });
    await openPopup(FREE_CHAT_ACTION as Action, conversationId);
  }, [context, dbReady, rect, openPopup, toolbarReady]);

  const handleDismissToolbar = useCallback(() => {
    setShowToolbar(false);
    void dismissSelectionOverlay();
  }, []);

  const handleExpand = useCallback(async () => {
    if (!popup) return;
    await rpcClient.call('conversation:promote', { conversationId: popup.conversationId, mode: 'chat' });
    await emit('selection:open-workspace', { conversationId: popup.conversationId });
    setPopup(null);
    await setOverlayBusy(false);
    void dismissSelectionOverlay();
  }, [popup, setOverlayBusy]);

  const popupRect = cachedRectRef.current ?? rect;
  const popupPosition = popupRect ? getPopupPosition(popupRect) : { top: 80, left: 80 };
  const { position, dragging, onHeaderMouseDown } = usePopupDrag(popupRef, popupPosition);
  useResizablePopup(popupRef, POPUP_DEFAULT_WIDTH, POPUP_DEFAULT_HEIGHT);
  useKeyboardIsolation(popupRef);
  useClickOutside(popupRef, () => {
    if (popup) closePopup(popup.conversationId);
  }, { graceMs: 400 });

  useEffect(() => {
    if (!popup) return;

    const timer = window.setTimeout(() => {
      const input = popupRef.current?.querySelector('textarea');
      input?.focus();
    }, 120);

    return () => window.clearTimeout(timer);
  }, [popup?.conversationId]);

  // Shrink the native window to the toolbar chrome so Linux's opaque overlay
  // background cannot show as an empty dark rectangle under the buttons.
  // Sizing goes through the backend (GTK main thread) — a direct setSize from
  // the webview is unreliable on Linux.
  useEffect(() => {
    if (!showToolbar || popup) return;
    const el = toolbarRef.current;
    const monitor = cachedMonitorRef.current;
    const selectionRect = cachedRectRef.current;
    if (!el || !monitor || !selectionRect) return;

    let cancelled = false;
    let lastKey = '';

    const fit = () => {
      if (cancelled) return;
      // scrollWidth ignores the current window width, so the measurement cannot
      // feed back into itself and shrink the toolbar step by step.
      const width = Math.ceil(el.scrollWidth || el.getBoundingClientRect().width);
      const height = Math.ceil(el.scrollHeight || el.getBoundingClientRect().height);
      if (width < 8 || height < 8) return;

      const key = `${width}x${height}`;
      if (key === lastKey) return;
      lastKey = key;

      const bounds = toolbarScreenBounds(selectionRect, monitor, width, height);
      console.warn(`[selectmind] toolbar fit: css ${key} -> ${JSON.stringify(bounds)}`);
      void emit('selection:overlay-resize', bounds);
    };

    fit();
    const frame = window.requestAnimationFrame(fit);
    const observer = new ResizeObserver(fit);
    observer.observe(el);

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [showToolbar, popup, actions.length, actionError]);

  const popupFillsWindow = Boolean(popup);

  return (
    <div className="selection-overlay-root">
      {showToolbar && rect && context ? (
          <div
            ref={toolbarRef}
            className="saywa-toolbar"
            style={{ pointerEvents: toolbarReady ? 'auto' : 'none' }}
          >
            <div className="saywa-toolbar-inner">
              <button
                type="button"
                className="saywa-toolbar-btn saywa-toolbar-free-chat"
                title={FREE_CHAT_ACTION.name}
                disabled={!dbReady || !toolbarReady || !!runningId}
                onMouseDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  void openFreeChat();
                }}
              >
                <span className="saywa-toolbar-icon">{FREE_CHAT_ACTION.icon}</span>
              </button>

              <span className="saywa-toolbar-sep" />

              {actions.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  className="saywa-toolbar-btn"
                  title={action.name}
                  disabled={!dbReady || !toolbarReady || runningId === action.id}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    void runAction(action);
                  }}
                >
                  <span className="saywa-toolbar-icon">{action.icon}</span>
                </button>
              ))}

              <span className="saywa-toolbar-sep" />
              <button
                type="button"
                className="saywa-toolbar-btn saywa-toolbar-close"
                title="Close"
                onMouseDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
                onClick={handleDismissToolbar}
              >
                <span className="saywa-toolbar-icon">×</span>
              </button>
            </div>
            {actionError ? <p className="saywa-toolbar-error">{actionError}</p> : null}
          </div>
        ) : null}

      {popup && popupRect ? (
        <div
          ref={popupRef}
          style={
            popupFillsWindow
              ? {
                  position: 'fixed',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  maxWidth: 'none',
                  maxHeight: 'none',
                  pointerEvents: 'auto',
                  zIndex: 2147483647,
                }
              : popupPositionStyle(popupRect, position)
          }
          className={`saywa-chat-popup${dragging ? ' saywa-popup-dragging' : ''}${popupFillsWindow ? ' saywa-chat-popup-fill' : ''}`}
          onMouseDown={(event) => event.stopPropagation()}
        >
          <div className="saywa-chat-popup-header" onMouseDown={onHeaderMouseDown}>
            <span>{popup.action.icon}</span>
            <span className="saywa-chat-popup-title">{popup.action.name}</span>
            <button type="button" className="saywa-chat-popup-expand" onClick={() => void handleExpand()}>
              ⤢
            </button>
            <button
              type="button"
              className="saywa-chat-popup-close"
              onClick={() => closePopup(popup.conversationId)}
            >
              ×
            </button>
          </div>
          <div className="saywa-chat-popup-body">
            <ChatView
              conversationId={popup.conversationId}
              compact
              resolvePageContext={() => cachedContextRef.current ?? buildSelectionPageContext({
                text: '',
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                windowTitle: '',
              })}
              inputPlaceholder={
                popup.action.id === FREE_CHAT_ACTION.id ? FREE_CHAT_INPUT_PLACEHOLDER : undefined
              }
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function SelectionOverlayApp() {
  return (
    <QueryClientProvider client={queryClient}>
      <SelectionOverlayInner />
    </QueryClientProvider>
  );
}
