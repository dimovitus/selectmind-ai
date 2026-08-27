import { useEffect, useState } from 'react';
import { emit, listen } from '@tauri-apps/api/event';
import { formatLiveEngineBadge } from './engine-label';
import { LIVE_STATUS_STRIP_CSS_PX } from './live-overlay-manager';
import {
  projectOverlayCoord,
  quantizeOverlayCoord,
  resolveOverlayProjection,
} from './live-overlay-layout';
import { centerGrownBox, fitOverlayText, inflateCoverBox } from './live-overlay-fit';
import type { LiveOverlayPayload } from './types';
import './live.css';

const OVERLAY_FONT_FAMILY =
  'Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif';

/**
 * Text width scales linearly with font size, so one measurement at 100px is
 * enough to solve for the size that fits a box.
 */
function createTextMeasurer(): (text: string) => number {
  const cache = new Map<string, number>();
  let context: CanvasRenderingContext2D | null = null;

  return (text: string) => {
    const cached = cache.get(text);
    if (cached !== undefined) return cached;

    if (!context) {
      context = document.createElement('canvas').getContext('2d');
      if (context) context.font = `100px ${OVERLAY_FONT_FAMILY}`;
    }
    // Without a 2D context we fall back to average glyph width.
    const width = context ? context.measureText(text).width : text.length * 52;
    cache.set(text, width);
    return width;
  };
}

const measureTextAt100 = createTextMeasurer();

let loggedGeometry = '';

/** Misaligned boxes are almost always a region/viewport pixel-space mismatch. */
function logOverlayGeometryOnce(payload: LiveOverlayPayload): void {
  if (typeof window === 'undefined') return;
  const signature = `${payload.region.width}x${payload.region.height}@${payload.region.scaleFactor}->${window.innerWidth}x${window.innerHeight}`;
  if (signature === loggedGeometry) return;
  loggedGeometry = signature;
  console.warn(`[selectmind] live overlay geometry: ${signature}`);
}

const EMPTY: LiveOverlayPayload = {
  active: false,
  region: {
    monitorX: 0,
    monitorY: 0,
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    scaleFactor: 1,
  },
  lines: [],
};

function buildStatusText(payload: LiveOverlayPayload): string {
  const parts: string[] = [];
  if (payload.cancelHint) parts.push(payload.cancelHint);
  if (payload.offlineReserve) {
    parts.push('Offline reserve');
  }
  parts.push(payload.statusMessage ?? formatLiveEngineBadge(payload.engineUsed));
  if (payload.regionLabel) parts.push(payload.regionLabel);
  return parts.join(' · ');
}

export function LiveOverlayApp() {
  const [payload, setPayload] = useState<LiveOverlayPayload>(EMPTY);
  const [opacity, setOpacity] = useState(0.55);
  const [fontScale, setFontScale] = useState(1);

  useEffect(() => {
    document.documentElement.classList.add('live-overlay');
    return () => document.documentElement.classList.remove('live-overlay');
  }, []);

  useEffect(() => {
    const unlisten = listen<LiveOverlayPayload>('live:update', (event) => {
      const next = event.payload;
      setPayload(next);
      if (typeof next.overlayOpacity === 'number') {
        setOpacity(next.overlayOpacity);
      }
      if (typeof next.fontScale === 'number') {
        setFontScale(next.fontScale);
      }
    });

    return () => {
      void unlisten.then((dispose) => dispose());
    };
  }, []);

  if (!payload.active) {
    return <div className="live-overlay-root" />;
  }

  logOverlayGeometryOnce(payload);

  const scale = payload.region.scaleFactor > 0 ? payload.region.scaleFactor : 1;
  const isScreen = payload.coverage === 'screen';
  const stripPx = isScreen ? 0 : (payload.statusStripPx ?? LIVE_STATUS_STRIP_CSS_PX);
  const statusBase = isScreen ? 'live-overlay-pill' : 'live-overlay-status';
  const statusClass =
    payload.statusTone === 'warn' ? `${statusBase} ${statusBase}--warn` : statusBase;
  const maxFontPx = isScreen ? 36 : 22;
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : payload.region.width;
  const viewportHeight =
    typeof window !== 'undefined' ? window.innerHeight : payload.region.height;
  const projection = resolveOverlayProjection(payload.region.width, viewportWidth);
  const lineClassName = payload.animatePosition
    ? 'live-overlay-line live-overlay-line--animated'
    : 'live-overlay-line';

  return (
    <div className={payload.offlineReserve ? 'live-overlay-root live-overlay-root--degraded' : 'live-overlay-root'}>
      <div className={`${statusClass} live-overlay-status-row`}>
        <span className="live-overlay-status-text">{buildStatusText(payload)}</span>
        <button
          type="button"
          className={
            payload.continuousMode
              ? 'live-overlay-continuous live-overlay-continuous--on'
              : 'live-overlay-continuous'
          }
          title={
            payload.continuousMode
              ? 'Continuous on — click for on-demand'
              : 'Continuous off — click to keep updating'
          }
          onClick={() => {
            void emit('live:continuous-toggle-request');
          }}
        >
          {payload.continuousMode ? 'Continuous' : 'On-demand'}
        </button>
      </div>
      <div
        className="live-overlay-region"
        style={{ top: stripPx, height: `calc(100% - ${stripPx}px)` }}
      >
        {payload.showFrame !== false ? <div className="live-overlay-frame" aria-hidden /> : null}
        {payload.lines.map((line) => {
          // Cover the exact OCR box, plus a hair of padding for antialiasing.
          const box = inflateCoverBox(
            {
              left: projectOverlayCoord(line.x / scale, projection),
              top: projectOverlayCoord(line.y / scale, projection),
              width: Math.max(projectOverlayCoord(line.width / scale, projection), 16),
              height: Math.max(projectOverlayCoord(line.height / scale, projection), 14),
            },
            { width: viewportWidth, height: viewportHeight },
          );

          const fit = fitOverlayText({
            text: line.translatedText,
            boxWidth: box.width,
            boxHeight: box.height,
            widthAt100: measureTextAt100(line.translatedText),
            fontScale,
            maxFontPx,
            maxWidth: viewportWidth,
          });

          const left = centerGrownBox(box.left, box.width, fit.width, viewportWidth);

          return (
            <div
              key={line.id}
              className={lineClassName}
              style={{
                left: quantizeOverlayCoord(left, 2),
                top: quantizeOverlayCoord(box.top, 2),
                width: Math.round(fit.width),
                height: Math.round(box.height),
                fontSize: fit.fontSize,
                whiteSpace: fit.wrap ? 'normal' : 'nowrap',
                backgroundColor: `rgba(3, 7, 18, ${opacity})`,
              }}
              title={line.sourceText}
            >
              {line.translatedText}
            </div>
          );
        })}
      </div>
    </div>
  );
}
