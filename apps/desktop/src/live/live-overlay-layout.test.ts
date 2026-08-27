import { describe, expect, it } from 'vitest';
import {
  projectOverlayCoord,
  quantizeOverlayCoord,
  resolveOverlayProjection,
} from './live-overlay-layout';

describe('resolveOverlayProjection', () => {
  it('returns 1 when region and viewport match', () => {
    expect(resolveOverlayProjection(1920, 1920)).toBe(1);
  });

  it('shrinks region coordinates when the WebView lays out smaller', () => {
    expect(resolveOverlayProjection(1920, 1600)).toBeCloseTo(0.8333, 3);
  });

  it('grows region coordinates when the WebView lays out larger', () => {
    expect(resolveOverlayProjection(1600, 1920)).toBeCloseTo(1.2, 3);
  });

  it('ignores tiny rounding differences', () => {
    expect(resolveOverlayProjection(1920, 1918)).toBe(1);
  });

  it('maps a box at the far edge of the region onto the viewport edge', () => {
    const projection = resolveOverlayProjection(1920, 1600);
    expect(projectOverlayCoord(1920, projection)).toBeCloseTo(1600, 6);
  });
});

describe('projectOverlayCoord', () => {
  it('passes through when the projection is 1', () => {
    expect(projectOverlayCoord(120, 1)).toBe(120);
  });
});

describe('quantizeOverlayCoord', () => {
  it('snaps to the given step', () => {
    expect(quantizeOverlayCoord(103, 2)).toBe(104);
    expect(quantizeOverlayCoord(101, 4)).toBe(100);
  });
});
