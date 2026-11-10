import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react';

const VIEWPORT_MARGIN = 12;
const SIZE_STORAGE_PREFIX = 'saywa_popup_size_';

export interface PopupSize {
  width: number;
  height: number;
}

export interface ResizablePopupOptions {
  defaultWidth: number;
  defaultHeight: number;
  minWidth?: number;
  minHeight?: number;
  storageKey: string;
}

export interface ResizablePopupResult {
  size: PopupSize;
  resizing: boolean;
  onResizeStart: (event: ReactPointerEvent<HTMLElement>) => void;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}

function clampSize(
  width: number,
  height: number,
  minWidth: number,
  minHeight: number,
): PopupSize {
  const maxWidth = Math.max(minWidth, window.innerWidth - VIEWPORT_MARGIN * 2);
  const maxHeight = Math.max(minHeight, window.innerHeight - VIEWPORT_MARGIN * 2);
  return {
    width: Math.round(clamp(width, minWidth, maxWidth)),
    height: Math.round(clamp(height, minHeight, maxHeight)),
  };
}

function isValidSize(value: unknown): value is PopupSize {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<PopupSize>;
  return (
    typeof candidate.width === 'number' &&
    Number.isFinite(candidate.width) &&
    candidate.width > 0 &&
    typeof candidate.height === 'number' &&
    Number.isFinite(candidate.height) &&
    candidate.height > 0
  );
}

async function readStoredSize(storageKey: string): Promise<PopupSize | null> {
  try {
    if (typeof chrome !== 'undefined') {
      const result = await chrome.storage.local.get(storageKey);
      const stored: unknown = result[storageKey];
      if (isValidSize(stored)) return stored;
    }
  } catch {
    // Fall through to sessionStorage.
  }

  try {
    const raw = sessionStorage.getItem(SIZE_STORAGE_PREFIX + storageKey);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isValidSize(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function storeSize(storageKey: string, size: PopupSize): void {
  try {
    if (typeof chrome !== 'undefined') {
      void chrome.storage.local.set({ [storageKey]: size }).catch(() => {});
    }
  } catch {
    // Ignore storage failures; the popup is still usable.
  }

  try {
    sessionStorage.setItem(SIZE_STORAGE_PREFIX + storageKey, JSON.stringify(size));
  } catch {
    // Ignore storage failures.
  }
}

/** Stop keyboard events from reaching the host page (YouTube shortcuts, etc.). */
export function useKeyboardIsolation(ref: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const isolate = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement) {
        const tag = target.tagName;
        if (tag === 'TEXTAREA' || tag === 'INPUT' || target.isContentEditable) {
          // Let the event bubble to the React root (delegated listeners), but not to the page.
          return;
        }
      }
      event.stopPropagation();
    };

    el.addEventListener('keydown', isolate);
    el.addEventListener('keyup', isolate);
    el.addEventListener('keypress', isolate);

    return () => {
      el.removeEventListener('keydown', isolate);
      el.removeEventListener('keyup', isolate);
      el.removeEventListener('keypress', isolate);
    };
  }, [ref]);
}

function clampPopupPosition(
  top: number,
  left: number,
  el: HTMLElement,
): { top: number; left: number } {
  const width = el.offsetWidth;
  const height = el.offsetHeight;

  return {
    top: Math.max(VIEWPORT_MARGIN, Math.min(top, window.innerHeight - height - VIEWPORT_MARGIN)),
    left: Math.max(VIEWPORT_MARGIN, Math.min(left, window.innerWidth - width - VIEWPORT_MARGIN)),
  };
}

/** Drag popup by its header. */
export function usePopupDrag(
  popupRef: RefObject<HTMLElement | null>,
  initial: { top: number; left: number },
): {
  position: { top: number; left: number };
  dragging: boolean;
  onHeaderMouseDown: (event: ReactMouseEvent) => void;
} {
  const [position, setPosition] = useState(initial);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{ x: number; y: number; top: number; left: number } | null>(null);

  const initialTop = initial.top;
  const initialLeft = initial.left;

  useEffect(() => {
    setPosition({ top: initialTop, left: initialLeft });
  }, [initialTop, initialLeft]);

  // Keep the popup inside the viewport after it is resized (or its content changes).
  useEffect(() => {
    const el = popupRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(() => {
      setPosition((current) => {
        const next = clampPopupPosition(current.top, current.left, el);
        return next.top === current.top && next.left === current.left ? current : next;
      });
    });
    observer.observe(el);
    return () => {
      observer.disconnect();
    };
  }, [popupRef]);

  const onHeaderMouseDown = useCallback(
    (event: ReactMouseEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest('button')) return;

      event.preventDefault();
      event.stopPropagation();

      dragRef.current = {
        x: event.clientX,
        y: event.clientY,
        top: position.top,
        left: position.left,
      };
      setDragging(true);

      const onMove = (moveEvent: MouseEvent) => {
        if (!dragRef.current || !popupRef.current) return;
        const dx = moveEvent.clientX - dragRef.current.x;
        const dy = moveEvent.clientY - dragRef.current.y;
        setPosition(
          clampPopupPosition(
            dragRef.current.top + dy,
            dragRef.current.left + dx,
            popupRef.current,
          ),
        );
      };

      const onUp = () => {
        dragRef.current = null;
        setDragging(false);
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    },
    [popupRef, position.top, position.left],
  );

  return { position, dragging, onHeaderMouseDown };
}

/**
 * In-place resizing for a floating popup.
 *
 * The size is rendered by React (not written imperatively), so it survives
 * streaming re-renders. Size is persisted in chrome.storage.local and restored
 * on the next popup.
 */
export function useResizablePopup(
  _ref: RefObject<HTMLElement | null>,
  options: ResizablePopupOptions,
): ResizablePopupResult {
  const {
    defaultWidth,
    defaultHeight,
    minWidth = 340,
    minHeight = 260,
    storageKey,
  } = options;

  const [size, setSize] = useState<PopupSize>(() =>
    clampSize(defaultWidth, defaultHeight, minWidth, minHeight),
  );
  const [resizing, setResizing] = useState(false);
  const sizeRef = useRef(size);
  const didResizeRef = useRef(false);
  sizeRef.current = size;

  useEffect(() => {
    let cancelled = false;
    void readStoredSize(storageKey).then((stored) => {
      if (cancelled || !stored) return;
      setSize(clampSize(stored.width, stored.height, minWidth, minHeight));
    });
    return () => {
      cancelled = true;
    };
  }, [storageKey, minWidth, minHeight]);

  useEffect(() => {
    const onWindowResize = () => {
      setSize((current) => clampSize(current.width, current.height, minWidth, minHeight));
    };
    window.addEventListener('resize', onWindowResize);
    return () => {
      window.removeEventListener('resize', onWindowResize);
    };
  }, [minWidth, minHeight]);

  const onResizeStart = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      event.preventDefault();
      event.stopPropagation();

      const startX = event.clientX;
      const startY = event.clientY;
      const startWidth = sizeRef.current.width;
      const startHeight = sizeRef.current.height;
      setResizing(true);

      const onMove = (moveEvent: PointerEvent) => {
        setSize(
          clampSize(
            startWidth + moveEvent.clientX - startX,
            startHeight + moveEvent.clientY - startY,
            minWidth,
            minHeight,
          ),
        );
      };

      const finish = () => {
        setResizing(false);
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', finish);
        window.removeEventListener('pointercancel', finish);
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', finish);
      window.addEventListener('pointercancel', finish);
    },
    [minWidth, minHeight],
  );

  useEffect(() => {
    if (resizing) {
      didResizeRef.current = true;
      return;
    }
    if (!didResizeRef.current) return;
    didResizeRef.current = false;
    storeSize(storageKey, sizeRef.current);
  }, [resizing, storageKey]);

  return { size, resizing, onResizeStart };
}
