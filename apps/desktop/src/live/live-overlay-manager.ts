import { emitTo } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { PhysicalPosition, PhysicalSize } from '@tauri-apps/api/dpi';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { waitForOverlayDismiss } from '../capture/capture-utils';
import type { LiveOverlayPayload, LiveRegion } from './types';

const OVERLAY_LABEL = 'live-overlay';

/** Status strip above the capture region (CSS px at 1x). */
export const LIVE_STATUS_STRIP_CSS_PX = 24;

let appliedGeometry: string | null = null;
let overlayVisible = false;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export async function getLiveOverlayWindow(): Promise<WebviewWindow> {
  const existing = await WebviewWindow.getByLabel(OVERLAY_LABEL);
  if (existing) return existing;
  throw new Error('Live overlay window is not configured');
}

/**
 * Ask Windows to keep the overlay off screen captures (Win10 2004+).
 * When this succeeds the overlay can stay visible while OCR runs.
 */
export async function setLiveOverlayCaptureShield(exclude: boolean): Promise<boolean> {
  try {
    return await invoke<boolean>('live_set_capture_exclusion', {
      args: { label: OVERLAY_LABEL, exclude },
    });
  } catch {
    return false;
  }
}

function geometryKey(region: LiveRegion, stripPx: number): string {
  return [
    region.monitorX,
    region.monitorY,
    region.x,
    region.y,
    region.width,
    region.height,
    region.scaleFactor,
    stripPx,
  ].join(':');
}

async function applyOverlayGeometry(region: LiveRegion, stripPx: number): Promise<void> {
  const key = geometryKey(region, stripPx);
  if (key === appliedGeometry) return;

  const overlay = await getLiveOverlayWindow();
  // Full-screen coverage passes stripPx = 0 — the status pill floats inside instead.
  const stripPhysical = Math.max(Math.round(stripPx * region.scaleFactor), 0);
  const screenX = region.monitorX + Math.round(region.x * region.scaleFactor);
  const screenY = region.monitorY + Math.round(region.y * region.scaleFactor);
  const screenW = Math.max(Math.round(region.width * region.scaleFactor), 1);
  const screenH = Math.max(Math.round(region.height * region.scaleFactor), 1);

  await overlay.setDecorations(false);
  await overlay.setSkipTaskbar(true);
  await overlay.setPosition(new PhysicalPosition(screenX, screenY - stripPhysical));
  await overlay.setSize(new PhysicalSize(screenW, screenH + stripPhysical));
  await overlay.setAlwaysOnTop(true);
  appliedGeometry = key;
}

/**
 * Boot the overlay webview and confirm it is listening before the live loop
 * starts, so the first payload is never dropped on a cold webview.
 */
async function boostLiveOverlayWindow(): Promise<void> {
  try {
    await invoke('live_boost_overlay');
  } catch {
    // Best effort — Tauri alwaysOnTop is still set in geometry.
  }
}

export async function prewarmLiveOverlay(payload: LiveOverlayPayload): Promise<void> {
  const overlay = await getLiveOverlayWindow();
  await applyOverlayGeometry(payload.region, payload.statusStripPx ?? LIVE_STATUS_STRIP_CSS_PX);
  await overlay.show();
  overlayVisible = true;
  try {
    await overlay.setIgnoreCursorEvents(true);
  } catch {
    // GTK panics if click-through is applied before the native window exists.
  }
  await boostLiveOverlayWindow();

  for (let attempt = 0; attempt < 3; attempt += 1) {
    await emitTo(OVERLAY_LABEL, 'live:update', payload);
    await sleep(attempt === 0 ? 120 : 80);
  }
}

export async function showLiveOverlay(payload: LiveOverlayPayload): Promise<void> {
  const stripPx = payload.statusStripPx ?? LIVE_STATUS_STRIP_CSS_PX;
  await applyOverlayGeometry(payload.region, stripPx);

  if (!overlayVisible) {
    const overlay = await getLiveOverlayWindow();
    await overlay.show();
    overlayVisible = true;
    try {
      await overlay.setIgnoreCursorEvents(true);
    } catch {
      // GTK panics if click-through is applied before the native window exists.
    }
  }

  await boostLiveOverlayWindow();
  await emitTo(OVERLAY_LABEL, 'live:update', payload);
}

/**
 * Fallback path when capture exclusion is unavailable.
 * Must wait for DWM to actually drop the window from composition —
 * otherwise live_scan still OCRs our own translation boxes.
 */
export async function hideLiveOverlayForScan(): Promise<void> {
  if (!overlayVisible) return;
  const overlay = await getLiveOverlayWindow();
  await overlay.hide();
  overlayVisible = false;
  await waitForOverlayDismiss();
  // Extra settle: WebView2 hide can lag one compositor frame behind JS.
  await sleep(80);
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
  overlayVisible = false;
  appliedGeometry = null;
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
