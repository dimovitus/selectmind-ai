import { emit, emitTo } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { PhysicalPosition, PhysicalSize } from '@tauri-apps/api/dpi';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import type { OverlayMonitor, SelectionSnapshot } from './types';

const OVERLAY_LABEL = 'selection-overlay';

export async function getSelectionOverlayWindow(): Promise<WebviewWindow> {
  const existing = await WebviewWindow.getByLabel(OVERLAY_LABEL);
  if (existing) return existing;
  throw new Error('Selection overlay window is not configured');
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => window.setTimeout(resolve, ms));
}

/** Ensure the overlay webview is loaded before the first real selection. */
export async function prewarmSelectionOverlay(): Promise<void> {
  const overlay = await getSelectionOverlayWindow();
  await overlay.show();
  await sleep(900);
  await overlay.hide();
}

export async function showSelectionOverlay(snapshot: SelectionSnapshot): Promise<void> {
  const overlay = await getSelectionOverlayWindow();
  const monitor = await invoke<OverlayMonitor>('get_monitor_at_point', {
    x: snapshot.x + Math.max(Math.floor(snapshot.width / 2), 1),
    y: snapshot.y + Math.max(Math.floor(snapshot.height / 2), 1),
  });

  const payload = { snapshot, monitor };

  await overlay.setDecorations(false);
  await overlay.setAlwaysOnTop(true);
  await overlay.setPosition(new PhysicalPosition(monitor.x, monitor.y));
  await overlay.setSize(new PhysicalSize(monitor.width, monitor.height));
  await overlay.show();

  // The overlay webview may still be booting on first show — retry delivery.
  for (let attempt = 0; attempt < 6; attempt += 1) {
    await emitTo(OVERLAY_LABEL, 'selection:show', payload);
    await sleep(attempt === 0 ? 80 : 50);
  }
}

export async function hideSelectionOverlay(): Promise<void> {
  const overlay = await getSelectionOverlayWindow();
  await emitTo(OVERLAY_LABEL, 'selection:hide', {});
  await overlay.hide();
}

export async function dismissSelectionOverlay(): Promise<void> {
  await hideSelectionOverlay();
  await emit('selection:overlay-dismissed', {});
}
