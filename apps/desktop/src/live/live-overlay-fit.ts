/**
 * Fit a translation inside the OCR box of the text it replaces.
 *
 * Russian renders ~20% wider than English, so a font picked from box height
 * alone overflows and gets clipped. Measure the string, shrink to fit, and only
 * widen the box when even the smallest readable size does not fit.
 */

/** Horizontal padding inside the box (both sides combined). */
const PADDING_X = 6;
/** Below this the overlay stops being readable on a 1080p screen. */
const MIN_FONT_PX = 10;
/** Fraction of box height used by a single line of text. */
const SINGLE_LINE_HEIGHT_RATIO = 0.8;
/** Two stacked lines need to share the same height. */
const TWO_LINE_HEIGHT_RATIO = 0.44;
/**
 * Wrapping never splits evenly, so the longest of two lines is wider than half
 * the string.
 */
const TWO_LINE_WIDTH_SHARE = 0.58;
/** How much wider than the original text a box may grow to stay readable. */
const MAX_GROWTH_RATIO = 1.6;

export interface OverlayTextFit {
  fontSize: number;
  /** Final box width — equals boxWidth unless growth was required. */
  width: number;
  /** Whether the text is allowed to wrap onto a second line. */
  wrap: boolean;
}

export interface OverlayFitParams {
  text: string;
  boxWidth: number;
  boxHeight: number;
  /** Width of `text` rendered at font-size 100px, in CSS pixels. */
  widthAt100: number;
  fontScale: number;
  maxFontPx: number;
  /** Space available before the box would leave the screen. */
  maxWidth: number;
}

function fontForWidth(available: number, widthPerPx: number): number {
  if (widthPerPx <= 0) return Number.POSITIVE_INFINITY;
  return Math.max(available, 0) / widthPerPx;
}

export function fitOverlayText(params: OverlayFitParams): OverlayTextFit {
  const { boxWidth, boxHeight, fontScale, maxFontPx, maxWidth } = params;
  const widthPerPx = params.widthAt100 / 100;

  if (widthPerPx <= 0) {
    return { fontSize: MIN_FONT_PX, width: boxWidth, wrap: false };
  }

  const available = boxWidth - PADDING_X;
  const singleLineCap = Math.min(boxHeight * SINGLE_LINE_HEIGHT_RATIO * fontScale, maxFontPx);
  const singleLine = Math.min(singleLineCap, fontForWidth(available, widthPerPx));

  const twoLineCap = Math.min(boxHeight * TWO_LINE_HEIGHT_RATIO * fontScale, maxFontPx);
  const twoLine = Math.min(
    twoLineCap,
    fontForWidth(available, widthPerPx * TWO_LINE_WIDTH_SHARE),
  );

  const wrap = twoLine > singleLine;
  const best = Math.max(singleLine, twoLine);

  if (best >= MIN_FONT_PX) {
    return { fontSize: Math.round(best), width: boxWidth, wrap };
  }

  // Even wrapped text is unreadable at this width — widen the box instead of
  // hiding the translation behind `overflow: hidden`.
  const share = boxHeight * TWO_LINE_HEIGHT_RATIO * fontScale >= MIN_FONT_PX
    ? TWO_LINE_WIDTH_SHARE
    : 1;
  const neededWidth = widthPerPx * share * MIN_FONT_PX + PADDING_X;
  const grownWidth = Math.min(
    Math.max(boxWidth, neededWidth),
    boxWidth * MAX_GROWTH_RATIO,
    maxWidth,
  );

  const grownCap = share === 1 ? singleLineCap : twoLineCap;
  const grownFont = Math.min(
    Math.max(grownCap, MIN_FONT_PX),
    fontForWidth(grownWidth - PADDING_X, widthPerPx * share),
  );

  return {
    fontSize: Math.max(MIN_FONT_PX, Math.round(grownFont)),
    width: Math.round(grownWidth),
    wrap: share !== 1,
  };
}

/**
 * Grow the OCR box slightly so the original glyphs (including antialiasing and
 * descenders) stay hidden behind the translation.
 */
export function inflateCoverBox(
  box: { left: number; top: number; width: number; height: number },
  viewport: { width: number; height: number },
): { left: number; top: number; width: number; height: number } {
  const padX = Math.max(2, Math.round(box.height * 0.12));
  const padY = Math.max(2, Math.round(box.height * 0.1));
  const left = Math.max(0, box.left - padX);
  const top = Math.max(0, box.top - padY);
  return {
    left,
    top,
    width: Math.min(box.width + padX * 2, Math.max(viewport.width - left, 1)),
    height: Math.min(box.height + padY * 2, Math.max(viewport.height - top, 1)),
  };
}

/** Keep a grown box centred on the text it covers, without leaving the screen. */
export function centerGrownBox(
  left: number,
  originalWidth: number,
  grownWidth: number,
  viewportWidth: number,
): number {
  if (grownWidth <= originalWidth) return left;
  const centered = left - (grownWidth - originalWidth) / 2;
  const clamped = Math.min(Math.max(centered, 0), Math.max(viewportWidth - grownWidth, 0));
  return Math.round(clamped);
}
