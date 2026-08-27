export interface OcrOptions {
  languages?: string[];
}

/** Text recognition from image data URL. */
export interface OcrPort {
  recognizeText(imageDataUrl: string, options?: OcrOptions): Promise<string>;
}
