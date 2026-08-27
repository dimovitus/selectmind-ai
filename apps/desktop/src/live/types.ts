export interface LiveRegion {
  monitorX: number;
  monitorY: number;
  x: number;
  y: number;
  width: number;
  height: number;
  scaleFactor: number;
}

export interface OcrLineBox {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LiveScanResult {
  frameUnchanged: boolean;
  lines: OcrLineBox[];
  frameHash: number;
  width: number;
  height: number;
  /** Average brightness 0–255; near zero means the capture came back blank. */
  meanLuma: number;
  /** Max minus min sampled brightness; ~0 means a uniform (failed) capture. */
  lumaRange: number;
  rawLineCount: number;
  /** Language tag of the OCR engine that ran. */
  ocrLanguage: string;
  /** Share of 8×8 cells that changed vs previous frame (0–100). */
  roiAreaPct: number;
  /** `skip` | `roi` | `full` */
  ocrScope: string;
}

export interface LiveTranslatedLine {
  id: string;
  sourceText: string;
  translatedText: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LiveOverlayPayload {
  region: LiveRegion;
  lines: LiveTranslatedLine[];
  active: boolean;
  overlayOpacity?: number;
  fontScale?: number;
  engineUsed?: string | null;
  statusMessage?: string | null;
  statusTone?: 'info' | 'warn' | null;
  regionLabel?: string | null;
  /** Dashed border around the capture region while live mode is active. */
  showFrame?: boolean;
  /** Whole monitor (RetroArch style) or a hand-picked region. */
  coverage?: 'screen' | 'region';
  /** Hint shown above the region (e.g. hotkey to stop). */
  cancelHint?: string | null;
  /** CSS pixels reserved above the capture region for the status strip. */
  statusStripPx?: number;
  /** Animate overlay position between OCR scans (continuous mode). */
  animatePosition?: boolean;
  /** Session is in Continuous (looping) mode. */
  continuousMode?: boolean;
  /** Network engine failed → offline reserve is painting. */
  offlineReserve?: boolean;
}

export interface LiveStateChangedPayload {
  active: boolean;
}
