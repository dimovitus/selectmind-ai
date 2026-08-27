/** Snap jittering OCR coordinates to a grid so boxes stop micro-shifting. */
export function quantizeOverlayCoord(value: number, step: number): number {
  return Math.round(value / step) * step;
}

/**
 * OCR boxes arrive in region pixels, but the overlay WebView lays out in its own
 * CSS pixels — fractional display scaling (KDE at 120%, HiDPI) makes the two
 * spaces differ. Returns the multiplier that maps region → viewport; without it
 * every box drifts further from its text the lower it sits on screen.
 */
export function resolveOverlayProjection(
  regionWidthCss: number,
  viewportWidthCss: number,
): number {
  if (regionWidthCss <= 0 || viewportWidthCss <= 0) return 1;
  const ratio = viewportWidthCss / regionWidthCss;
  if (!Number.isFinite(ratio) || Math.abs(ratio - 1) < 0.008) return 1;
  return ratio;
}

export function projectOverlayCoord(value: number, projection: number): number {
  if (projection === 1) return value;
  return value * projection;
}
