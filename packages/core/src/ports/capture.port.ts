import type { ScreenRegion, ScreenshotCapture } from '../types/capture';

export interface CaptureVisibleOptions {
  /** Browser window id; desktop may ignore. */
  windowId?: number;
  format?: 'jpeg' | 'png';
  quality?: number;
}

/**
 * Screen capture — extension uses visible tab; desktop uses OS APIs.
 * Region flow (picker → crop) stays in application layer.
 */
export interface CapturePort {
  captureVisibleSurface(options?: CaptureVisibleOptions): Promise<string>;
  cropImage?(sourceDataUrl: string, region: ScreenRegion, devicePixelRatio: number): Promise<string>;
  captureRegion?(region: ScreenRegion): Promise<ScreenshotCapture>;
}
