import { appendToContentLayer } from '@/content/ui/mount';
import type { ScreenRegion } from '@/shared/types/screenshot';

const MIN_SIZE = 24;

export interface RegionSelectorResult {
  region: ScreenRegion;
  devicePixelRatio: number;
}

export function selectScreenRegion(): Promise<RegionSelectorResult | null> {
  return new Promise((resolve) => {
    const dpr = window.devicePixelRatio || 1;
    const root = document.createElement('div');
    root.className = 'saywa-capture-root';
    root.tabIndex = -1;
    root.innerHTML = `
      <div class="saywa-capture-hint">Drag to select an area · Enter to capture · Esc to cancel</div>
      <div class="saywa-capture-shade saywa-capture-shade-top"></div>
      <div class="saywa-capture-shade saywa-capture-shade-left"></div>
      <div class="saywa-capture-shade saywa-capture-shade-right"></div>
      <div class="saywa-capture-shade saywa-capture-shade-bottom"></div>
      <div class="saywa-capture-selection"></div>
    `;

    const selection = root.querySelector('.saywa-capture-selection') as HTMLDivElement;
    const shades = {
      top: root.querySelector('.saywa-capture-shade-top') as HTMLDivElement,
      left: root.querySelector('.saywa-capture-shade-left') as HTMLDivElement,
      right: root.querySelector('.saywa-capture-shade-right') as HTMLDivElement,
      bottom: root.querySelector('.saywa-capture-shade-bottom') as HTMLDivElement,
    };

    let startX = 0;
    let startY = 0;
    let current: ScreenRegion | null = null;
    let dragging = false;

    const cleanup = (result: RegionSelectorResult | null) => {
      root.remove();
      document.removeEventListener('keydown', onKeyDown, true);
      resolve(result);
    };

    const updateLayout = (region: ScreenRegion | null) => {
      if (!region) {
        selection.style.display = 'none';
        Object.values(shades).forEach((el) => {
          el.style.display = 'none';
        });
        return;
      }

      selection.style.display = 'block';
      selection.style.left = `${region.x}px`;
      selection.style.top = `${region.y}px`;
      selection.style.width = `${region.width}px`;
      selection.style.height = `${region.height}px`;

      shades.top.style.display = 'block';
      shades.left.style.display = 'block';
      shades.right.style.display = 'block';
      shades.bottom.style.display = 'block';

      shades.top.style.top = '0';
      shades.top.style.left = '0';
      shades.top.style.width = '100vw';
      shades.top.style.height = `${region.y}px`;

      shades.left.style.top = `${region.y}px`;
      shades.left.style.left = '0';
      shades.left.style.width = `${region.x}px`;
      shades.left.style.height = `${region.height}px`;

      shades.right.style.top = `${region.y}px`;
      shades.right.style.left = `${region.x + region.width}px`;
      shades.right.style.width = `calc(100vw - ${region.x + region.width}px)`;
      shades.right.style.height = `${region.height}px`;

      shades.bottom.style.top = `${region.y + region.height}px`;
      shades.bottom.style.left = '0';
      shades.bottom.style.width = '100vw';
      shades.bottom.style.height = `calc(100vh - ${region.y + region.height}px)`;
    };

    const normalizeRegion = (x1: number, y1: number, x2: number, y2: number): ScreenRegion => {
      const x = Math.min(x1, x2);
      const y = Math.min(y1, y2);
      const width = Math.abs(x2 - x1);
      const height = Math.abs(y2 - y1);
      return {
        x: Math.max(0, Math.min(x, window.innerWidth - 1)),
        y: Math.max(0, Math.min(y, window.innerHeight - 1)),
        width: Math.min(width, window.innerWidth - x),
        height: Math.min(height, window.innerHeight - y),
      };
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        cleanup(null);
        return;
      }
      if (event.key === 'Enter' && current && current.width >= MIN_SIZE && current.height >= MIN_SIZE) {
        event.preventDefault();
        event.stopPropagation();
        cleanup({ region: current, devicePixelRatio: dpr });
      }
    };

    root.addEventListener('mousedown', (event) => {
      if (event.button !== 0) return;
      dragging = true;
      startX = event.clientX;
      startY = event.clientY;
      current = normalizeRegion(startX, startY, startX, startY);
      updateLayout(current);
      event.preventDefault();
    });

    root.addEventListener('mousemove', (event) => {
      if (!dragging) return;
      current = normalizeRegion(startX, startY, event.clientX, event.clientY);
      updateLayout(current);
    });

    root.addEventListener('mouseup', (event) => {
      if (!dragging) return;
      dragging = false;
      current = normalizeRegion(startX, startY, event.clientX, event.clientY);
      updateLayout(current);
      if (current.width >= MIN_SIZE && current.height >= MIN_SIZE) {
        cleanup({ region: current, devicePixelRatio: dpr });
      }
    });

    document.addEventListener('keydown', onKeyDown, true);
    requestAnimationFrame(() => {
      appendToContentLayer(root);
      root.focus();
    });
  });
}
