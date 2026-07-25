let workerPromise: Promise<import('tesseract.js').Worker> | null = null;

async function getOcrWorker(): Promise<import('tesseract.js').Worker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('eng+rus', 1, {
        logger: () => {},
      });
      return worker;
    })();
  }
  return workerPromise;
}

export async function recognizeScreenshotText(dataUrl: string): Promise<string> {
  try {
    const worker = await getOcrWorker();
    const result = await worker.recognize(dataUrl);
    return result.data.text.trim();
  } catch {
    return '';
  }
}
