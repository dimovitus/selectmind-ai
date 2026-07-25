import { type ReactNode, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';

export { toolbarPositionStyle, popupPositionStyle } from './positioning';

const HOST_ID = 'saywa-root';

let shadowRoot: ShadowRoot | null = null;
let reactRoot: Root | null = null;

function bindKeyboardBoundary(container: HTMLElement): void {
  const stopAtExtension = (event: Event) => {
    event.stopPropagation();
  };

  container.addEventListener('keydown', stopAtExtension);
  container.addEventListener('keyup', stopAtExtension);
  container.addEventListener('keypress', stopAtExtension);
}

export function mountContentUI(children: ReactNode, styles: string): void {
  let host = document.getElementById(HOST_ID);

  if (!host) {
    host = document.createElement('div');
    host.id = HOST_ID;
    host.style.cssText =
      'all: initial; position: fixed; inset: 0; z-index: 2147483647; pointer-events: none; overflow: visible;';
    bindKeyboardBoundary(host);
    document.documentElement.appendChild(host);
    shadowRoot = host.attachShadow({ mode: 'closed' });
  }

  if (!shadowRoot) return;

  let appContainer = shadowRoot.querySelector('#saywa-app') as HTMLElement | null;
  if (!appContainer) {
    const styleEl = document.createElement('style');
    styleEl.textContent = styles;
    shadowRoot.appendChild(styleEl);

    appContainer = document.createElement('div');
    appContainer.id = 'saywa-app';
    appContainer.style.cssText = 'position: fixed; inset: 0; pointer-events: none; overflow: visible;';
    shadowRoot.appendChild(appContainer);
  }

  if (!reactRoot) {
    reactRoot = createRoot(appContainer);
  }

  reactRoot.render(children);
}

/** Append a full-screen overlay inside the content script layer (shadow DOM). */
export function appendToContentLayer(element: HTMLElement): void {
  const app = shadowRoot?.querySelector('#saywa-app') as HTMLElement | null;
  if (app) {
    element.style.pointerEvents = 'auto';
    app.appendChild(element);
    return;
  }
  element.style.pointerEvents = 'auto';
  document.body.appendChild(element);
}

export function unmountContentUI(): void {
  reactRoot?.unmount();
  reactRoot = null;
  document.getElementById(HOST_ID)?.remove();
  shadowRoot = null;
}

export function useClickOutside(
  ref: React.RefObject<HTMLElement | null>,
  handler: () => void,
  options?: { graceMs?: number },
): void {
  const graceMs = options?.graceMs ?? 0;

  useEffect(() => {
    let active = graceMs === 0;
    const graceTimer =
      graceMs > 0
        ? window.setTimeout(() => {
            active = true;
          }, graceMs)
        : undefined;

    const listener = (event: MouseEvent) => {
      if (!active || !ref.current) return;
      const path = event.composedPath();
      if (path.includes(ref.current)) return;
      handler();
    };
    document.addEventListener('mousedown', listener);
    return () => {
      document.removeEventListener('mousedown', listener);
      if (graceTimer) window.clearTimeout(graceTimer);
    };
  }, [ref, handler, graceMs]);
}
