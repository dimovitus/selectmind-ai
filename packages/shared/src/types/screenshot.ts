export interface ScreenshotCapture {
  dataUrl: string;
  ocrText?: string;
  width: number;
  height: number;
}

export interface ScreenRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}
