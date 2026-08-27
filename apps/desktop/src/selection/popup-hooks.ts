import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type RefObject,
} from 'react';

const VIEWPORT_MARGIN = 12;
const POPUP_SIZE_KEY = 'selectmind-desktop-popup-size-v2';
export const POPUP_DEFAULT_WIDTH = 560;
export const POPUP_DEFAULT_HEIGHT = 600;
const DEFAULT_WIDTH = POPUP_DEFAULT_WIDTH;
const DEFAULT_HEIGHT = POPUP_DEFAULT_HEIGHT;

interface PopupSize {
  width: number;
  height: number;
}

function readStoredSize(): PopupSize | null {
  try {
    const raw = sessionStorage.getItem(POPUP_SIZE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PopupSize;
    if (typeof parsed.width === 'number' && typeof parsed.height === 'number') {
      return parsed;
    }
  } catch {
    // ignore
  }
  return null;
}

function storeSize(size: PopupSize): void {
  try {
    sessionStorage.setItem(POPUP_SIZE_KEY, JSON.stringify(size));
  } catch {
    // ignore
  }
}

export function useKeyboardIsolation(ref: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const isolate = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement) {
        const tag = target.tagName;
        if (tag === 'TEXTAREA' || tag === 'INPUT' || target.isContentEditable) {
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

  useEffect(() => {
    setPosition(initial);
  }, [initial.top, initial.left]);

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

export function useResizablePopup(
  ref: RefObject<HTMLElement | null>,
  baseWidth = DEFAULT_WIDTH,
  baseHeight = DEFAULT_HEIGHT,
): void {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const stored = readStoredSize();
    if (stored) {
      el.style.width = `${stored.width}px`;
      el.style.height = `${stored.height}px`;
    }

    let saveTimer: number | undefined;

    const updateScale = () => {
      const width = el.offsetWidth;
      const height = el.offsetHeight;
      const scale = Math.min(Math.max(Math.min(width / baseWidth, height / baseHeight), 0.85), 2);
      el.style.setProperty('--saywa-popup-scale', scale.toFixed(3));

      window.clearTimeout(saveTimer);
      saveTimer = window.setTimeout(() => {
        storeSize({ width, height });
      }, 200);
    };

    updateScale();

    const ro = new ResizeObserver(() => updateScale());
    ro.observe(el);

    return () => {
      ro.disconnect();
      window.clearTimeout(saveTimer);
    };
  }, [ref, baseWidth, baseHeight]);
}

export function useClickOutside(
  ref: RefObject<HTMLElement | null>,
  handler: () => void,
  options?: { graceMs?: number },
): void {
  const graceMs = options?.graceMs ?? 0;

  useEffect(() => {
    const startedAt = Date.now();

    const onPointerDown = (event: PointerEvent) => {
      if (Date.now() - startedAt < graceMs) return;
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (ref.current?.contains(target)) return;
      handler();
    };

    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [ref, handler, graceMs]);
}
