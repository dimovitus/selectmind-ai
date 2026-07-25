export interface SelectionSnapshot {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  windowTitle: string;
}

export interface SelectionRect {
  top: number;
  left: number;
  bottom: number;
  right: number;
  width: number;
  height: number;
}

export interface OverlayMonitor {
  x: number;
  y: number;
  width: number;
  height: number;
  scaleFactor: number;
}

/**
 * Snapshot bounds are physical screen pixels; the overlay webview lays out in CSS
 * pixels, so everything is divided by the monitor scale factor.
 */
export function snapshotToRect(snapshot: SelectionSnapshot, monitor: OverlayMonitor): SelectionRect {
  const scale = monitor.scaleFactor > 0 ? monitor.scaleFactor : 1;
  const left = (snapshot.x - monitor.x) / scale;
  const top = (snapshot.y - monitor.y) / scale;
  const width = Math.max(snapshot.width / scale, 1);
  const height = Math.max(snapshot.height / scale, 1);

  return {
    left,
    top,
    bottom: top + height,
    right: left + width,
    width,
    height,
  };
}
