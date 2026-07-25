import type { PlatformPorts } from '@selectmind/core';
import { getExtensionPlatform } from '@/platform/extension';
import { cropImageDataUrl } from '@/shared/utils/crop-image';
import type { ScreenshotCapture } from '@/shared/types/screenshot';
import type { PageContext } from '@/shared/types/page-context';
import type { RegionSelectorResult } from './region-selector';
import { selectScreenRegion } from './region-selector';

async function cropCapturedImage(
  platform: PlatformPorts,
  sourceDataUrl: string,
  picked: RegionSelectorResult,
): Promise<string> {
  if (platform.capture.cropImage) {
    return platform.capture.cropImage(
      sourceDataUrl,
      picked.region,
      picked.devicePixelRatio,
    );
  }
  return cropImageDataUrl(sourceDataUrl, picked.region, picked.devicePixelRatio);
}

async function waitForOverlayDismiss(): Promise<void> {
  if (typeof requestAnimationFrame === 'function') {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
    return;
  }
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

/** Region already picked — capture tab, crop, OCR via platform ports. */
export async function completeScreenCaptureFromRegion(
  picked: RegionSelectorResult,
  platform: PlatformPorts = getExtensionPlatform(),
): Promise<ScreenshotCapture> {
  await waitForOverlayDismiss();

  const tabDataUrl = await platform.capture.captureVisibleSurface();
  const cropped = await cropCapturedImage(platform, tabDataUrl, picked);
  const ocrText = await platform.ocr.recognizeText(cropped, { languages: ['eng', 'rus'] });

  return {
    dataUrl: cropped,
    ocrText: ocrText.trim() || undefined,
    width: Math.round(picked.region.width),
    height: Math.round(picked.region.height),
  };
}

export async function runScreenCaptureFlow(
  platform: PlatformPorts = getExtensionPlatform(),
): Promise<ScreenshotCapture | null> {
  const picked = await selectScreenRegion();
  if (!picked) return null;
  return completeScreenCaptureFromRegion(picked, platform);
}

export async function buildScreenshotPageContext(
  screenshot: ScreenshotCapture,
  platform: PlatformPorts = getExtensionPlatform(),
): Promise<PageContext> {
  const base = await Promise.resolve(platform.pageContext.extractCurrentContext());
  return {
    ...base,
    selection: screenshot.ocrText?.trim() ?? base.selection,
    screenshot,
  };
}
