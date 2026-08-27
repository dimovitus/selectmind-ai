import { describe, expect, it } from 'vitest';
import { toolbarScreenBounds } from './positioning';
import type { OverlayMonitor, SelectionRect } from './types';

const monitor: OverlayMonitor = { x: 0, y: 0, width: 1920, height: 1080, scaleFactor: 1 };

function rect(top: number, left: number, width: number, height: number): SelectionRect {
  return { top, left, bottom: top + height, right: left + width, width, height };
}

describe('toolbarScreenBounds', () => {
  it('hugs the measured toolbar size instead of a fixed width', () => {
    const bounds = toolbarScreenBounds(rect(400, 300, 200, 20), monitor, 372, 44);

    expect(bounds.width).toBe(372);
    expect(bounds.height).toBe(44);
    expect(bounds.x).toBe(300);
    expect(bounds.y).toBe(428);
  });

  it('flips above the selection when there is no room below', () => {
    const bounds = toolbarScreenBounds(rect(1040, 300, 200, 20), monitor, 372, 44);

    expect(bounds.y).toBe(988);
  });

  it('keeps the toolbar inside the monitor horizontally', () => {
    const bounds = toolbarScreenBounds(rect(400, 1900, 10, 20), monitor, 372, 44);

    expect(bounds.x).toBe(1920 - 372 - 12);
  });

  it('scales CSS pixels to physical pixels on HiDPI monitors', () => {
    const hidpi: OverlayMonitor = { x: 0, y: 0, width: 3840, height: 2160, scaleFactor: 2 };
    const bounds = toolbarScreenBounds(rect(400, 300, 200, 20), hidpi, 372, 44);

    expect(bounds.width).toBe(744);
    expect(bounds.height).toBe(88);
    expect(bounds.x).toBe(600);
  });
});
