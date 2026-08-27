import { emit, listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { runDesktopScreenshotChat } from '../capture/init-capture-hotkey';
import { isOcrToolbarBusy, runDesktopOcrToolbarFlow } from '../capture/init-ocr-toolbar';
import { isRegionPickerActive } from '../capture/region-picker-store';
import { formatUnknownError } from '../capture/capture-utils';
import {
  getLiveTranslateError,
  toggleContinuousLiveTranslate,
  toggleLiveTranslate,
} from '../live/live-controller';
import { showMainWindowFromTray } from './tray-window';

type ActionKind = 'ocr-chat' | 'ocr-toolbar' | 'live';

type ActionListener = {
  onBusy?: (busy: boolean, kind: ActionKind) => void;
  onError?: (message: string) => void;
  onPalette?: () => void;
  onOcrChatComplete?: (conversationId: string) => void;
};

/** A stalled flow must not silence the tray forever — retrying unsticks it. */
const BUSY_OVERRIDE_MS = 10_000;

let registered = false;
let busySince = 0;
let listener: ActionListener = {};

/** Workspace (or anyone) can hook UI feedback without owning the tray handlers. */
export function setDesktopActionListener(next: ActionListener): void {
  listener = next;
}

/**
 * Tray / Rust emit events into the main webview. Register these as soon as the
 * main window boots — do not wait for React/Workspace, otherwise the tray menu
 * looks alive while every action is a no-op (blank or still-loading UI).
 */
export async function registerDesktopTrayActions(): Promise<void> {
  if (registered) return;
  registered = true;

  const main = getCurrentWindow();

  const withBusy = async (kind: ActionKind, run: () => Promise<void>) => {
    if (busySince && Date.now() - busySince < BUSY_OVERRIDE_MS) return;
    if (busySince) {
      // Previous flow never settled (hung picker / overlay). Cancel it and wait
      // for it to unwind so the new request can take over instead of being
      // dropped silently by the capture-side guards.
      await emit('capture:picker-cancel');
      for (let i = 0; i < 20 && (isOcrToolbarBusy() || isRegionPickerActive()); i += 1) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
    busySince = Date.now();
    listener.onBusy?.(true, kind);
    try {
      await run();
    } catch (error) {
      const message = formatUnknownError(error, `${kind} failed`);
      listener.onError?.(message);
      console.error(`[selectmind] ${kind}:`, error);
      try {
        await showMainWindowFromTray(main);
      } catch {
        // Best-effort: surface the failure even if focus fails.
      }
    } finally {
      busySince = 0;
      listener.onBusy?.(false, kind);
    }
  };

  // OCR chat: region → explain screenshot → open conversation in main window.
  await listen('desktop:ocr-chat-request', () => {
    console.warn('[selectmind] tray: ocr-chat request received');
    void withBusy('ocr-chat', async () => {
      await runDesktopScreenshotChat(
        (conversationId) => {
          listener.onOcrChatComplete?.(conversationId);
          void showMainWindowFromTray(main);
        },
        (message) => {
          listener.onError?.(message);
          void showMainWindowFromTray(main);
        },
      );
    });
  });

  // OCR toolbar: region → OCR → floating action toolbar (main stays hidden).
  await listen('desktop:ocr-toolbar-request', () => {
    console.warn('[selectmind] tray: ocr-toolbar request received');
    void withBusy('ocr-toolbar', async () => {
      await runDesktopOcrToolbarFlow((message) => {
        listener.onError?.(message);
        void showMainWindowFromTray(main);
      });
    });
  });

  // Live must not share the OCR busy lock — a hung picker would otherwise
  // swallow Ctrl+Shift+L / tray Live with no feedback. Toggle is idempotent.
  let liveToggleAt = 0;
  await listen('live:toggle-request', () => {
    const now = Date.now();
    // X11 auto-repeat / double tray fires would start+cancel in the same breath.
    if (now - liveToggleAt < 400) {
      console.warn('[selectmind] tray: live-toggle debounced');
      return;
    }
    liveToggleAt = now;
    console.warn('[selectmind] tray: live-toggle request received');
    void (async () => {
      listener.onBusy?.(true, 'live');
      try {
        await toggleLiveTranslate();
        const error = getLiveTranslateError();
        if (error) {
          listener.onError?.(error);
          await showMainWindowFromTray(main);
        }
      } catch (error) {
        const message = formatUnknownError(error, 'live failed');
        listener.onError?.(message);
        console.error('[selectmind] live:', error);
        try {
          await showMainWindowFromTray(main);
        } catch {
          // Best-effort.
        }
      } finally {
        listener.onBusy?.(false, 'live');
      }
    })();
  });

  let continuousToggleAt = 0;
  await listen('live:continuous-toggle-request', () => {
    const now = Date.now();
    if (now - continuousToggleAt < 400) {
      console.warn('[selectmind] tray: continuous-toggle debounced');
      return;
    }
    continuousToggleAt = now;
    console.warn('[selectmind] tray: continuous-toggle request received');
    void (async () => {
      listener.onBusy?.(true, 'live');
      try {
        const mode = await toggleContinuousLiveTranslate();
        console.warn(`[selectmind] continuous mode → ${mode}`);
        const error = getLiveTranslateError();
        if (error) {
          listener.onError?.(error);
          await showMainWindowFromTray(main);
        }
      } catch (error) {
        const message = formatUnknownError(error, 'continuous toggle failed');
        listener.onError?.(message);
        console.error('[selectmind] continuous toggle:', error);
        try {
          await showMainWindowFromTray(main);
        } catch {
          // Best-effort.
        }
      } finally {
        listener.onBusy?.(false, 'live');
      }
    })();
  });

  await listen('desktop:palette-request', () => {
    void (async () => {
      await showMainWindowFromTray(main);
      if (listener.onPalette) {
        listener.onPalette();
        return;
      }
      // Workspace not mounted yet — open as soon as it registers.
      const pending = window.setInterval(() => {
        if (listener.onPalette) {
          window.clearInterval(pending);
          listener.onPalette();
        }
      }, 50);
      window.setTimeout(() => window.clearInterval(pending), 5000);
    })();
  });
}
