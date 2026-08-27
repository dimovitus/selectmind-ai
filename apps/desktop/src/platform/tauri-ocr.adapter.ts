import { invoke } from '@tauri-apps/api/core';
import type { OcrOptions, OcrPort } from '@selectmind/core';
import { readDesktopExtras } from '../settings/desktop-extras';

let workerPromise: Promise<import('tesseract.js').Worker> | null = null;
let lastOcrError: string | null = null;

export function getLastOcrError(): string | null {
  return lastOcrError;
}

async function getWorker(): Promise<import('tesseract.js').Worker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker } = await import('tesseract.js');
      return createWorker('eng+rus', 1, { logger: () => {} });
    })();
  }
  return workerPromise;
}

async function recognizeWithTesseractJs(imageDataUrl: string): Promise<string> {
  try {
    const worker = await getWorker();
    const result = await worker.recognize(imageDataUrl);
    return result.data.text.trim();
  } catch (error) {
    lastOcrError = error instanceof Error ? error.message : String(error);
    return '';
  }
}

async function recognizeWithNative(imageDataUrl: string): Promise<string> {
  const text = await invoke<string>('ocr_recognize_data_url', { dataUrl: imageDataUrl });
  return text.trim();
}

/** Desktop: native OCR (Windows OCR / Tesseract CLI) with tesseract.js fallback. */
export class TauriOcrAdapter implements OcrPort {
  async recognizeText(imageDataUrl: string, _options?: OcrOptions): Promise<string> {
    lastOcrError = null;
    const { ocrEngine } = readDesktopExtras();

    if (ocrEngine === 'tesseract') {
      return recognizeWithTesseractJs(imageDataUrl);
    }

    if (ocrEngine === 'windows') {
      try {
        return await recognizeWithNative(imageDataUrl);
      } catch (error) {
        lastOcrError = error instanceof Error ? error.message : String(error);
        return recognizeWithTesseractJs(imageDataUrl);
      }
    }

    try {
      const nativeText = await recognizeWithNative(imageDataUrl);
      if (nativeText) return nativeText;
    } catch (error) {
      lastOcrError = error instanceof Error ? error.message : String(error);
      console.warn('[selectmind] native OCR failed:', lastOcrError);
    }

    return recognizeWithTesseractJs(imageDataUrl);
  }
}
