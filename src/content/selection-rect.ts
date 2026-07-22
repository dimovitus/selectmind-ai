export interface SelectionRect {
  top: number;
  left: number;
  bottom: number;
  right: number;
  width: number;
  height: number;
}

export function captureRect(rect: DOMRect | SelectionRect): SelectionRect {
  return {
    top: rect.top,
    left: rect.left,
    bottom: rect.bottom,
    right: rect.right,
    width: rect.width,
    height: rect.height,
  };
}

export function getSelectionRect(): SelectionRect | null {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null;

  const range = selection.getRangeAt(0);
  const clientRects = Array.from(range.getClientRects()).filter(
    (r) => r.width > 0 || r.height > 0,
  );

  const target = clientRects.length > 0 ? clientRects[clientRects.length - 1]! : range.getBoundingClientRect();
  if (target.width === 0 && target.height === 0) return null;

  return captureRect(target);
}
