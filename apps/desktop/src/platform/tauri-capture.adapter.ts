import { invoke } from '@tauri-apps/api/core';
import type {
  CapturePort,
  CaptureVisibleOptions,
  ScreenRegion,
  ScreenshotCapture,
} from '@selectmind/core';
import { cropImageDataUrl } from '@selectmind/shared';

interface CaptureRegionArgs {
  x: number;
  y: number;
  width: number;
  height: number;
  scaleFactor: number;
  monitorX?: number;
  monitorY?: number;
}

/** Desktop Phase 2: OS monitor capture via Rust/xcap. */
export class TauriCaptureAdapter implements CapturePort {
  async captureVisibleSurface(_options?: CaptureVisibleOptions): Promise<string> {
    return invoke<string>('capture_screen_surface');
  }

  async cropImage(
    sourceDataUrl: string,
    region: ScreenRegion,
    devicePixelRatio: number,
  ): Promise<string> {
    return cropImageDataUrl(sourceDataUrl, region, devicePixelRatio);
  }

  async captureRegion(region: ScreenRegion): Promise<ScreenshotCapture> {
    return this.captureRegionOnMonitor(region);
  }

  async capturePickedRegion(picked: {
    region: ScreenRegion;
    monitor: { x: number; y: number };
  }): Promise<ScreenshotCapture> {
    return this.captureRegionOnMonitor(picked.region, picked.monitor);
  }

  private async captureRegionOnMonitor(
    region: ScreenRegion,
    monitor?: { x: number; y: number },
  ): Promise<ScreenshotCapture> {
    const devicePixelRatio = window.devicePixelRatio || 1;
    const dataUrl = await invoke<string>('capture_screen_region', {
      args: {
        x: Math.round(region.x),
        y: Math.round(region.y),
        width: Math.round(region.width),
        height: Math.round(region.height),
        scaleFactor: devicePixelRatio,
        monitorX: monitor?.x,
        monitorY: monitor?.y,
      } satisfies CaptureRegionArgs,
    });

    return {
      dataUrl,
      width: Math.round(region.width),
      height: Math.round(region.height),
    };
  }
}
