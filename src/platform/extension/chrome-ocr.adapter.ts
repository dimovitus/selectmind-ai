import type { OcrPort, OcrOptions } from '@selectmind/core';
import { recognizeScreenshotText } from '@/content/screen-capture/ocr';

/** Chrome extension: tesseract.js in content script */
export class ChromeOcrAdapter implements OcrPort {
  async recognizeText(imageDataUrl: string, _options?: OcrOptions): Promise<string> {
    return recognizeScreenshotText(imageDataUrl);
  }
}
