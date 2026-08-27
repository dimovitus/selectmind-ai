import type { CSSProperties } from 'react';
import type { OverlayMonitor, SelectionRect } from './types';

import {
  POPUP_DEFAULT_HEIGHT,
  POPUP_DEFAULT_WIDTH,
} from './popup-hooks';

const GAP = 8;
const MARGIN = 12;
const TOOLBAR_HEIGHT = 44;
const POPUP_WIDTH = POPUP_DEFAULT_WIDTH;
const POPUP_EST_HEIGHT = POPUP_DEFAULT_HEIGHT;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}

export function toolbarPositionStyle(rect: SelectionRect): CSSProperties {
  const vh = window.innerHeight;
  const vw = window.innerWidth;

  let top = rect.bottom + GAP;
  if (top + TOOLBAR_HEIGHT > vh - MARGIN) {
    top = rect.top - TOOLBAR_HEIGHT - GAP;
  }
  top = clamp(top, MARGIN, vh - TOOLBAR_HEIGHT - MARGIN);

  const left = clamp(rect.left, MARGIN, vw - 320 - MARGIN);

  return {
    position: 'fixed',
    top: `${top}px`,
    left: `${left}px`,
    pointerEvents: 'auto',
    zIndex: 2147483647,
  };
}

export function getPopupPosition(rect: SelectionRect): { top: number; left: number } {
  const vh = window.innerHeight;
  const vw = window.innerWidth;
  const width = Math.min(POPUP_WIDTH, vw - MARGIN * 2);

  let top = rect.bottom + GAP + TOOLBAR_HEIGHT;
  if (top + POPUP_EST_HEIGHT > vh - MARGIN) {
    top = rect.top - POPUP_EST_HEIGHT - GAP;
  }
  top = clamp(top, MARGIN, vh - POPUP_EST_HEIGHT - MARGIN);

  const left = clamp(rect.left, MARGIN, vw - width - MARGIN);

  return { top, left };
}

export function popupScreenBounds(
  rect: SelectionRect,
  monitor: OverlayMonitor,
  position?: { top: number; left: number },
): { x: number; y: number; width: number; height: number } {
  const scale = monitor.scaleFactor > 0 ? monitor.scaleFactor : 1;
  const pos = position ?? getPopupPosition(rect);
  const cssWidth = Math.min(POPUP_WIDTH, monitor.width / scale - MARGIN * 2);
  const cssHeight = Math.min(POPUP_DEFAULT_HEIGHT, monitor.height / scale - pos.top - MARGIN);

  return {
    x: monitor.x + Math.round(pos.left * scale),
    y: monitor.y + Math.round(pos.top * scale),
    width: Math.round(cssWidth * scale),
    height: Math.round(cssHeight * scale),
  };
}

/**
 * Native window bounds (physical px) for a toolbar of a measured CSS size,
 * anchored under the selection. Mirrors `toolbar_window_bounds` in Rust, but
 * uses the real rendered width so no button gets clipped.
 */
export function toolbarScreenBounds(
  rect: SelectionRect,
  monitor: OverlayMonitor,
  cssWidth: number,
  cssHeight: number,
): { x: number; y: number; width: number; height: number } {
  const scale = monitor.scaleFactor > 0 ? monitor.scaleFactor : 1;
  const vw = monitor.width / scale;
  const vh = monitor.height / scale;

  const width = Math.min(cssWidth, vw - MARGIN * 2);
  const height = Math.min(cssHeight, vh - MARGIN * 2);

  let top = rect.bottom + GAP;
  if (top + height > vh - MARGIN) {
    top = rect.top - height - GAP;
  }
  top = clamp(top, MARGIN, Math.max(MARGIN, vh - height - MARGIN));

  const left = clamp(rect.left, MARGIN, Math.max(MARGIN, vw - width - MARGIN));

  return {
    x: monitor.x + Math.round(left * scale),
    y: monitor.y + Math.round(top * scale),
    width: Math.max(Math.round(width * scale), 1),
    height: Math.max(Math.round(height * scale), 1),
  };
}

export function monitorOverlayBounds(monitor: OverlayMonitor): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  return {
    x: monitor.x,
    y: monitor.y,
    width: monitor.width,
    height: monitor.height,
  };
}

export function popupPositionStyle(
  rect: SelectionRect,
  position?: { top: number; left: number },
): CSSProperties {
  const vh = window.innerHeight;
  const vw = window.innerWidth;
  const width = Math.min(POPUP_WIDTH, vw - MARGIN * 2);
  const { top, left } = position ?? getPopupPosition(rect);

  return {
    position: 'fixed',
    top: `${top}px`,
    left: `${left}px`,
    width: `${width}px`,
    maxHeight: `${vh - top - MARGIN}px`,
    pointerEvents: 'auto',
    zIndex: 2147483647,
  };
}
