import { invoke } from '@tauri-apps/api/core';
import { emit, listen } from '@tauri-apps/api/event';
import { PhysicalPosition, PhysicalSize } from '@tauri-apps/api/dpi';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import type { ScreenRegion } from '@selectmind/core';
import type { RegionPickerResult } from './region-picker-store';
import { sleep, waitForOverlayDismiss } from './capture-utils';

const OVERLAY_LABEL = 'capture-overlay';
const PICKER_TIMEOUT_MS = 60_000;

interface MonitorInfo {
  x: number;
  y: number;
  width: number;
  height: number;
  scaleFactor: number;
}

interface PickerDonePayload {
  result: {
    region: ScreenRegion;
    devicePixelRatio: number;
    viewportWidth: number;
    viewportHeight: number;
  } | null;
}

export function normalizePickRegion(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): ScreenRegion {
  const x = Math.min(x1, x2);
  const y = Math.min(y1, y2);
  const width = Math.abs(x2 - x1);
  const height = Math.abs(y2 - y1);

  return {
    x: Math.max(0, x),
    y: Math.max(0, y),
    width: Math.max(0, Math.min(width, window.innerWidth - x)),
    height: Math.max(0, Math.min(height, window.innerHeight - y)),
  };
}

async function getOverlayWindow(): Promise<WebviewWindow> {
  const existing = await WebviewWindow.getByLabel(OVERLAY_LABEL);
  if (existing) return existing;
  throw new Error('Capture overlay window is not configured');
}

async function waitForCaptureOverlayReady(): Promise<void> {
  await new Promise<void>((resolve) => {
    let settled = false;
    let unlistenFn: (() => void) | null = null;
    const finish = () => {
      if (settled) return;
      settled = true;
      unlistenFn?.();
      resolve();
    };

    void listen('capture:overlay-ready', () => finish()).then((unlisten) => {
      unlistenFn = unlisten;
      if (settled) unlisten();
    });
    window.setTimeout(finish, 1500);
    void emit('capture:overlay-ping');
  });
}

async function registerPickerEscape(onCancel: () => void): Promise<(() => Promise<void>) | null> {
  try {
    const { register, unregister } = await import('@tauri-apps/plugin-global-shortcut');
    await register('Escape', (event) => {
      if (event.state === 'Pressed') onCancel();
    });
    return async () => {
      await unregister('Escape');
    };
  } catch {
    return null;
  }
}

/**
 * Hide the main window, freeze the monitor into the picker, return the region
 * in overlay CSS pixels. WebKitGTK cannot paint a transparent fullscreen window
 * (it shows a black panel), so the picker displays a screenshot instead.
 */
export async function requestRegionSelection(): Promise<RegionPickerResult | null> {
  const step = (name: string) => console.warn(`[selectmind] picker: ${name}`);
  step('start');
  const main = getCurrentWindow();
  const overlay = await getOverlayWindow();
  step('overlay window found');
  const monitor = await invoke<MonitorInfo>('get_monitor_info');
  step(`monitor ${JSON.stringify(monitor)}`);

  let settled = false;
  let resolvePick!: (result: PickerDonePayload['result']) => void;
  const pickPromise = new Promise<PickerDonePayload['result']>((resolve) => {
    resolvePick = (result) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };
  });

  const unlisten = await listen<PickerDonePayload>('capture:picker-done', (event) => {
    resolvePick(event.payload.result);
  });
  const unlistenCancel = await listen('capture:picker-cancel', () => resolvePick(null));

  const unregisterEscape = await registerPickerEscape(() => resolvePick(null));

  // Last resort: if the overlay webview never reports back (Escape registration
  // can fail on Linux), cancel instead of leaving the caller awaiting forever.
  const watchdog = window.setTimeout(() => resolvePick(null), PICKER_TIMEOUT_MS);

  await main.hide();
  step('main hidden');
  await waitForOverlayDismiss();
  await sleep(120);
  step('calling capture_screen_surface');

  let previewDataUrl: string;
  try {
    previewDataUrl = await invoke<string>('capture_screen_surface');
    step(`surface captured (${previewDataUrl.length} bytes)`);
  } catch (error) {
    step(`surface capture FAILED: ${String(error)}`);
    window.clearTimeout(watchdog);
    unlisten();
    unlistenCancel();
    if (unregisterEscape) await unregisterEscape();
    await main.show();
    throw error;
  }

  await overlay.setDecorations(false);
  await overlay.setPosition(new PhysicalPosition(monitor.x, monitor.y));
  await overlay.setSize(new PhysicalSize(monitor.width, monitor.height));
  await overlay.setAlwaysOnTop(true);
  await overlay.show();
  try {
    await overlay.setIgnoreCursorEvents(false);
  } catch {
    // GTK may reject this before the GdkWindow exists; show() above maps it.
  }
  await overlay.setFocus();
  step('overlay shown, waiting ready');
  await waitForCaptureOverlayReady();
  step('overlay ready, emitting start');
  // Retry: cold webviews often miss the first broadcast.
  for (let attempt = 0; attempt < 6; attempt += 1) {
    await emit('capture:overlay-start', {});
    await sleep(80);
  }

  try {
    const result = await pickPromise;
    step(result ? 'picked region' : 'pick cancelled/timeout');
    if (!result) return null;
    return { ...result, monitor, previewDataUrl };
  } finally {
    window.clearTimeout(watchdog);
    unlisten();
    unlistenCancel();
    if (unregisterEscape) {
      await unregisterEscape();
    }
    await emit('capture:overlay-start', { clear: true });
    await overlay.hide();
    await waitForOverlayDismiss();
  }
}
