import type { PlatformPorts } from '@selectmind/core';
import { cropImageDataUrl } from '@selectmind/shared';
import type { PageContext, ScreenshotCapture } from '@selectmind/shared';
import { createTauriPlatform, TauriCaptureAdapter } from '../platform';
import { cropPreviewToRegion, focusCaptureWindow, waitForOverlayDismiss } from './capture-utils';
import { requestRegionSelection, type RegionPickerResult } from './region-picker-store';

async function cropCapturedImage(
  platform: PlatformPorts,
  sourceDataUrl: string,
  picked: RegionPickerResult,
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

export async function completeScreenCaptureFromRegion(
  picked: RegionPickerResult,
  platform: PlatformPorts = createTauriPlatform(),
): Promise<ScreenshotCapture> {
  await waitForOverlayDismiss();

  if (picked.previewDataUrl) {
    const cropped = await cropPreviewToRegion(
      picked.previewDataUrl,
      picked.region,
      picked.viewportWidth ?? window.innerWidth,
      picked.viewportHeight ?? window.innerHeight,
    );
    const ocrText = await platform.ocr.recognizeText(cropped, {
      languages: ['eng', 'rus'],
    });
    return {
      dataUrl: cropped,
      ocrText: ocrText.trim() || undefined,
      width: Math.round(picked.region.width),
      height: Math.round(picked.region.height),
    };
  }

  if (platform.capture.captureRegion) {
    const capture = platform.capture as TauriCaptureAdapter;
    const captured =
      typeof capture.capturePickedRegion === 'function'
        ? await capture.capturePickedRegion(picked)
        : await platform.capture.captureRegion!(picked.region);
    const ocrText = await platform.ocr.recognizeText(captured.dataUrl, {
      languages: ['eng', 'rus'],
    });
    return {
      ...captured,
      ocrText: ocrText.trim() || undefined,
    };
  }

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

export async function runDesktopScreenCaptureFlow(
  platform: PlatformPorts = createTauriPlatform(),
): Promise<ScreenshotCapture | null> {
  let mainWasHidden = false;

  try {
    const picked = await requestRegionSelection();
    mainWasHidden = true;
    if (!picked) return null;
    return await completeScreenCaptureFromRegion(picked, platform);
  } finally {
    if (mainWasHidden) {
      await focusCaptureWindow();
    }
  }
}

export async function buildScreenshotPageContext(
  screenshot: ScreenshotCapture,
  platform: PlatformPorts = createTauriPlatform(),
): Promise<PageContext> {
  const base = await Promise.resolve(platform.pageContext.extractCurrentContext());
  return {
    ...base,
    selection: screenshot.ocrText?.trim() ?? base.selection,
    screenshot,
  };
}
