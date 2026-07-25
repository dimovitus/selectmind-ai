import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { PhysicalPosition, PhysicalSize } from '@tauri-apps/api/dpi';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import type { ScreenRegion } from '@selectmind/core';
import type { RegionPickerResult } from './region-picker-store';
import { waitForOverlayDismiss } from './capture-utils';

const OVERLAY_LABEL = 'capture-overlay';

interface MonitorInfo {
  x: number;
  y: number;
  width: number;
  height: number;
  scaleFactor: number;
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

/** Hide main window, show transparent overlay, return picked region in monitor coordinates. */
export async function requestRegionSelection(): Promise<RegionPickerResult | null> {
  const main = getCurrentWindow();
  const overlay = await getOverlayWindow();
  const monitor = await invoke<MonitorInfo>('get_monitor_info');

  let resolvePick: (result: RegionPickerResult | null) => void;
  const pickPromise = new Promise<RegionPickerResult | null>((resolve) => {
    resolvePick = resolve;
  });

  const unlisten = await listen<{ result: RegionPickerResult | null }>(
    'capture:picker-done',
    (event) => {
      resolvePick(event.payload.result);
    },
  );

  await main.hide();
  await overlay.setDecorations(false);
  await overlay.setPosition(new PhysicalPosition(monitor.x, monitor.y));
  await overlay.setSize(new PhysicalSize(monitor.width, monitor.height));
  await overlay.setAlwaysOnTop(true);
  await overlay.show();
  await overlay.setFocus();

  try {
    const result = await pickPromise;
    if (!result) return null;
    return { ...result, monitor };
  } finally {
    unlisten();
    await overlay.hide();
    await waitForOverlayDismiss();
    // Main window stays hidden until the screen region is captured
    // (see runDesktopScreenCaptureFlow).
  }
}
