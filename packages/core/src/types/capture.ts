/** Screen rectangle in CSS pixels (viewport coordinates). */
export interface ScreenRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Cropped screenshot with optional OCR text. */
export interface ScreenshotCapture {
  dataUrl: string;
  ocrText?: string;
  width: number;
  height: number;
}

/** Minimal page context snapshot for AI prompts. */
export interface PageContextSnapshot {
  selection: string;
  pageTitle: string;
  url: string;
  hostname: string;
  language: string;
  date: string;
  time: string;
  screenshot?: ScreenshotCapture;
}
