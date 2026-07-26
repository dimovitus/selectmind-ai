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
  regionLabel?: string | null;
}
