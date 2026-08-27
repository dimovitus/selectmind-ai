export function formatUnknownError(error: unknown, fallback: string): string {
  if (error instanceof Error) return error.message || fallback;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return fallback;
  }
}

async function tryWindowOp(label: string, operation: () => Promise<void>): Promise<void> {
  try {
    await operation();
  } catch (error) {
    console.warn(`Window ${label} failed:`, error);
  }
}

export async function focusCaptureWindow(): Promise<void> {
  const { getCurrentWindow } = await import('@tauri-apps/api/window');
  const window = getCurrentWindow();
  await tryWindowOp('show', () => window.show());
  await tryWindowOp('unminimize', () => window.unminimize());
  await tryWindowOp('setFocus', () => window.setFocus());
}

export async function waitForOverlayDismiss(): Promise<void> {
  await new Promise<void>((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve();
    };
    // rAF never fires in a hidden WebKitGTK window (this runs right after
    // main.hide() on Linux) — the timeout keeps the flow alive there.
    requestAnimationFrame(() => requestAnimationFrame(finish));
    window.setTimeout(finish, 150);
  });
  await new Promise<void>((resolve) => setTimeout(resolve, 50));
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

/** Map a CSS-pixel pick on the freeze-frame overlay onto the captured bitmap. */
export async function cropPreviewToRegion(
  previewDataUrl: string,
  region: { x: number; y: number; width: number; height: number },
  viewportWidth: number,
  viewportHeight: number,
): Promise<string> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Failed to load capture preview'));
    image.src = previewDataUrl;
  });

  const scaleX = img.naturalWidth / Math.max(viewportWidth, 1);
  const scaleY = img.naturalHeight / Math.max(viewportHeight, 1);
  const sx = Math.max(0, Math.round(region.x * scaleX));
  const sy = Math.max(0, Math.round(region.y * scaleY));
  const sw = Math.max(1, Math.min(Math.round(region.width * scaleX), img.naturalWidth - sx));
  const sh = Math.max(1, Math.min(Math.round(region.height * scaleY), img.naturalHeight - sy));

  const canvas = document.createElement('canvas');
  canvas.width = sw;
  canvas.height = sh;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not available');
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
  return canvas.toDataURL('image/png');
}
