import { useEffect, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import { formatLiveEngineBadge } from './engine-label';
import type { LiveOverlayPayload } from './types';
import './live.css';

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

function buildBadgeText(payload: LiveOverlayPayload): string {
  if (payload.statusMessage) return payload.statusMessage;

  const parts = [formatLiveEngineBadge(payload.engineUsed)];
  if (payload.regionLabel) parts.push(payload.regionLabel);
  return parts.join(' · ');
}

export function LiveOverlayApp() {
  const [payload, setPayload] = useState<LiveOverlayPayload>(EMPTY);
  const [opacity, setOpacity] = useState(0.82);
  const [fontScale, setFontScale] = useState(1);

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

  const scale = payload.region.scaleFactor > 0 ? payload.region.scaleFactor : 1;
  const badgeText = buildBadgeText(payload);
  const badgeClass = payload.statusMessage
    ? 'live-overlay-badge live-overlay-badge--warn'
    : 'live-overlay-badge';

  return (
    <div className="live-overlay-root">
      <div className={badgeClass}>{badgeText}</div>
      {payload.lines.map((line) => {
        const fontSize = Math.max(
          11,
          Math.min(22, Math.round((line.height / scale) * 0.72 * fontScale)),
        );
        return (
          <div
            key={line.id}
            className="live-overlay-line"
            style={{
              left: line.x / scale,
              top: line.y / scale,
              width: Math.max(line.width / scale, 40),
              minHeight: Math.max(line.height / scale, 16),
              fontSize,
              backgroundColor: `rgba(15, 23, 42, ${opacity})`,
            }}
          >
            {line.translatedText}
          </div>
        );
      })}
    </div>
  );
}
