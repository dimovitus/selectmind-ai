import { emitTo } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { PhysicalPosition, PhysicalSize } from '@tauri-apps/api/dpi';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import type { LiveOverlayPayload, LiveRegion } from './types';

const OVERLAY_LABEL = 'live-overlay';

export async function getLiveOverlayWindow(): Promise<WebviewWindow> {
  const existing = await WebviewWindow.getByLabel(OVERLAY_LABEL);
  if (existing) return existing;
  throw new Error('Live overlay window is not configured');
}

export async function showLiveOverlay(payload: LiveOverlayPayload): Promise<void> {
  const overlay = await getLiveOverlayWindow();
  const { region } = payload;
  const screenX = region.monitorX + Math.round(region.x * region.scaleFactor);
  const screenY = region.monitorY + Math.round(region.y * region.scaleFactor);
  const screenW = Math.max(Math.round(region.width * region.scaleFactor), 1);
  const screenH = Math.max(Math.round(region.height * region.scaleFactor), 1);

  await overlay.setDecorations(false);
  await overlay.setAlwaysOnTop(true);
  await overlay.setSkipTaskbar(true);
  await overlay.setPosition(new PhysicalPosition(screenX, screenY));
  await overlay.setSize(new PhysicalSize(screenW, screenH));

  try {
    await overlay.setIgnoreCursorEvents(true);
  } catch {
    // Best effort — overlay may still capture clicks on some platforms.
  }

  await overlay.show();
  await emitTo(OVERLAY_LABEL, 'live:update', payload);
}

export async function hideLiveOverlay(): Promise<void> {
  const overlay = await getLiveOverlayWindow();
  await emitTo(OVERLAY_LABEL, 'live:update', {
    active: false,
    region: {
      monitorX: 0,
      monitorY: 0,
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      scaleFactor: 1,
    },
    lines: [],
  } satisfies LiveOverlayPayload);
  await overlay.hide();
}

export function regionFromPicker(picked: {
  monitor: { x: number; y: number; scaleFactor: number };
  region: { x: number; y: number; width: number; height: number };
  devicePixelRatio?: number;
}): LiveRegion {
  const scale = picked.devicePixelRatio || picked.monitor.scaleFactor || 1;
  return {
    monitorX: picked.monitor.x,
    monitorY: picked.monitor.y,
    x: picked.region.x,
    y: picked.region.y,
    width: picked.region.width,
    height: picked.region.height,
    scaleFactor: scale,
  };
}

export async function persistLiveRegion(region: LiveRegion): Promise<void> {
  await invoke('live_set_region', {
    region: {
      monitorX: region.monitorX,
      monitorY: region.monitorY,
      x: region.x,
      y: region.y,
      width: region.width,
      height: region.height,
      scaleFactor: region.scaleFactor,
    },
  });
}

export async function clearPersistedLiveRegion(): Promise<void> {
  await invoke('live_clear_region');
}

export async function readPersistedLiveRegion(): Promise<LiveRegion | null> {
  return invoke<LiveRegion | null>('live_get_region');
}
