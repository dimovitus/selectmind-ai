import type { ScreenRegion } from '@/shared/types/screenshot';

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load screenshot image'));
    img.src = dataUrl;
  });
}

export async function cropImageDataUrl(
  dataUrl: string,
  region: ScreenRegion,
  devicePixelRatio = window.devicePixelRatio || 1,
): Promise<string> {
  const img = await loadImage(dataUrl);
  const sx = Math.round(region.x * devicePixelRatio);
  const sy = Math.round(region.y * devicePixelRatio);
  const sw = Math.max(1, Math.round(region.width * devicePixelRatio));
  const sh = Math.max(1, Math.round(region.height * devicePixelRatio));

  const canvas = document.createElement('canvas');
  canvas.width = sw;
  canvas.height = sh;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not available');

  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
  return canvas.toDataURL('image/jpeg', 0.9);
}
