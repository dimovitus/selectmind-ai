import type { CSSProperties } from 'react';
import type { SelectionRect } from '../selection-rect';

const GAP = 8;
const MARGIN = 12;
const TOOLBAR_HEIGHT = 44;
const POPUP_WIDTH = 420;
const POPUP_EST_HEIGHT = 280;

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
