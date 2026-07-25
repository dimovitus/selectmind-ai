import { invoke } from '@tauri-apps/api/core';
import type { OcrOptions, OcrPort } from '@selectmind/core';
import { readDesktopExtras } from '../settings/desktop-extras';

let workerPromise: Promise<import('tesseract.js').Worker> | null = null;

async function getWorker(): Promise<import('tesseract.js').Worker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker } = await import('tesseract.js');
      return createWorker('eng+rus', 1, { logger: () => {} });
    })();
  }
  return workerPromise;
}

async function recognizeWithTesseract(imageDataUrl: string): Promise<string> {
  try {
    const worker = await getWorker();
    const result = await worker.recognize(imageDataUrl);
    return result.data.text.trim();
  } catch {
    return '';
  }
}

async function recognizeWithWindows(imageDataUrl: string): Promise<string> {
  const text = await invoke<string>('ocr_recognize_data_url', { dataUrl: imageDataUrl });
  return text.trim();
}

/** Desktop Phase 4: Windows OCR API with tesseract.js fallback. */
export class TauriOcrAdapter implements OcrPort {
  async recognizeText(imageDataUrl: string, _options?: OcrOptions): Promise<string> {
    const { ocrEngine } = readDesktopExtras();

    if (ocrEngine === 'tesseract') {
      return recognizeWithTesseract(imageDataUrl);
    }

    if (ocrEngine === 'windows') {
      try {
        return await recognizeWithWindows(imageDataUrl);
      } catch {
        return recognizeWithTesseract(imageDataUrl);
      }
    }

    try {
      const windowsText = await recognizeWithWindows(imageDataUrl);
      if (windowsText) return windowsText;
    } catch {
      /* fall through to tesseract */
    }

    return recognizeWithTesseract(imageDataUrl);
  }
}
