import type { CSSProperties } from 'react';
import type { SelectionRect } from '../selection-rect';
import type { PopupSize } from './popup-hooks';

const GAP = 8;
const MARGIN = 12;
const TOOLBAR_HEIGHT = 44;

/** Default sizes for the two popup kinds. Keep in sync with the components. */
export const DEFAULT_CHAT_POPUP_SIZE: PopupSize = { width: 640, height: 600 };
export const DEFAULT_QUICK_POPUP_SIZE: PopupSize = { width: 640, height: 540 };

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
    top: `${String(top)}px`,
    left: `${String(left)}px`,
    pointerEvents: 'auto',
    zIndex: 2147483647,
  };
}

export function getPopupPosition(
  rect: SelectionRect,
  width = DEFAULT_CHAT_POPUP_SIZE.width,
  height = DEFAULT_CHAT_POPUP_SIZE.height,
): { top: number; left: number } {
  const vh = window.innerHeight;
  const vw = window.innerWidth;
  const popupWidth = Math.min(width, vw - MARGIN * 2);
  const popupHeight = Math.min(height, vh - MARGIN * 2);

  let top = rect.bottom + GAP + TOOLBAR_HEIGHT;
  if (top + popupHeight > vh - MARGIN) {
    top = rect.top - popupHeight - GAP;
  }
  top = clamp(top, MARGIN, vh - popupHeight - MARGIN);

  const left = clamp(rect.left, MARGIN, vw - popupWidth - MARGIN);

  return { top, left };
}

export function popupPositionStyle(
  rect: SelectionRect,
  position: { top: number; left: number } | undefined,
  size: PopupSize,
): CSSProperties {
  const vh = window.innerHeight;
  const vw = window.innerWidth;
  const width = Math.min(size.width, vw - MARGIN * 2);
  const height = Math.min(size.height, vh - MARGIN * 2);
  const base = position ?? getPopupPosition(rect, width, height);
  const top = clamp(base.top, MARGIN, Math.max(MARGIN, vh - height - MARGIN));
  const left = clamp(base.left, MARGIN, Math.max(MARGIN, vw - width - MARGIN));

  return {
    position: 'fixed',
    top: `${String(top)}px`,
    left: `${String(left)}px`,
    width: `${String(width)}px`,
    height: `${String(height)}px`,
    maxWidth: `calc(100vw - ${String(MARGIN * 2)}px)`,
    maxHeight: `calc(100vh - ${String(MARGIN * 2)}px)`,
    pointerEvents: 'auto',
    zIndex: 2147483647,
  };
}
