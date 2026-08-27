import type { LiveRegion, OcrLineBox } from './types';
import type { LiveScanFocus } from './live-settings';

/** Bottom portion of the screen where RPG / visual-novel subtitles usually sit. */
const DIALOGUE_BAND_FRACTION = 0.42;
/** Top portion where menu / HUD text often lives. */
const TOP_BAND_FRACTION = 0.35;
const MIN_BAND_HEIGHT_CSS = 100;

function bandRegion(
  displayRegion: LiveRegion,
  y: number,
  height: number,
): { region: LiveRegion; yOffsetPhysical: number } {
  return {
    region: {
      ...displayRegion,
      y,
      height,
    },
    yOffsetPhysical: y * displayRegion.scaleFactor,
  };
}

/**
 * OCR capture region for this tick. Full-screen overlay can stay full-size while
 * we only scan a band — much cheaper in continuous mode.
 */
export function resolveScanRegion(
  displayRegion: LiveRegion,
  options: { coverage: 'screen' | 'region'; scanFocus: LiveScanFocus },
): { region: LiveRegion; yOffsetPhysical: number } {
  if (options.coverage !== 'screen' || options.scanFocus === 'full') {
    return { region: displayRegion, yOffsetPhysical: 0 };
  }

  if (options.scanFocus === 'dialogue-band') {
    const bandHeight = Math.max(
      Math.floor(displayRegion.height * DIALOGUE_BAND_FRACTION),
      MIN_BAND_HEIGHT_CSS,
    );
    const bandTop = displayRegion.y + Math.max(displayRegion.height - bandHeight, 0);
    return bandRegion(displayRegion, bandTop, bandHeight);
  }

  const bandHeight = Math.max(
    Math.floor(displayRegion.height * TOP_BAND_FRACTION),
    MIN_BAND_HEIGHT_CSS,
  );
  return bandRegion(displayRegion, displayRegion.y, bandHeight);
}

/** OCR boxes are relative to the captured bitmap — shift back to full-screen space. */
export function offsetOcrLines(lines: OcrLineBox[], yOffsetPhysical: number): OcrLineBox[] {
  if (yOffsetPhysical <= 0) return lines;
  return lines.map((line) => ({ ...line, y: line.y + yOffsetPhysical }));
}
