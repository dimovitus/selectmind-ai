import type { CapturePort, CaptureVisibleOptions, ScreenRegion } from '@selectmind/core';
import { cropImageDataUrl } from '@/shared/utils/crop-image';

async function captureViaBackground(windowId?: number): Promise<string> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { type: 'saywa:capture-visible-tab', windowId },
      (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        const data = response as { dataUrl?: string; error?: string } | undefined;
        if (!data?.dataUrl) {
          reject(new Error(data?.error ?? 'Screenshot capture failed'));
          return;
        }
        resolve(data.dataUrl);
      },
    );
  });
}

/** Chrome extension: visible tab capture via background service worker */
export class ChromeCaptureAdapter implements CapturePort {
  async captureVisibleSurface(options?: CaptureVisibleOptions): Promise<string> {
    return captureViaBackground(options?.windowId);
  }

  async cropImage(sourceDataUrl: string, region: ScreenRegion, devicePixelRatio: number): Promise<string> {
    return cropImageDataUrl(sourceDataUrl, region, devicePixelRatio);
  }
}
