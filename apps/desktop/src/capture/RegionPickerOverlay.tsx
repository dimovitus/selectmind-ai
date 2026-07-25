import { useCallback, useEffect, useState } from 'react';
import { emit } from '@tauri-apps/api/event';
import { normalizePickRegion } from './overlay-pick';
import type { RegionPickerResult } from './region-picker-store';
import './capture.css';

const MIN_SIZE = 24;

type PickerSelection = Pick<RegionPickerResult, 'region' | 'devicePixelRatio'>;

export function CaptureOverlayApp() {
  const [region, setRegion] = useState<RegionPickerResult['region'] | null>(null);
  const [drag, setDrag] = useState<{ startX: number; startY: number } | null>(null);
  const dpr = window.devicePixelRatio || 1;

  const finish = useCallback(async (result: PickerSelection | null) => {
    setRegion(null);
    setDrag(null);
    await emit('capture:picker-done', { result });
  }, []);

  useEffect(() => {
    document.documentElement.classList.add('capture-overlay');
    return () => document.documentElement.classList.remove('capture-overlay');
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        void finish(null);
        return;
      }
      if (
        event.key === 'Enter' &&
        region &&
        region.width >= MIN_SIZE &&
        region.height >= MIN_SIZE
      ) {
        event.preventDefault();
        void finish({ region, devicePixelRatio: dpr });
      }
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [region, dpr, finish]);

  const onMouseDown = (event: React.MouseEvent) => {
    if (event.button !== 0) return;
    setDrag({ startX: event.clientX, startY: event.clientY });
    setRegion(normalizePickRegion(event.clientX, event.clientY, event.clientX, event.clientY));
  };

  const onMouseMove = (event: React.MouseEvent) => {
    if (!drag) return;
    setRegion(normalizePickRegion(drag.startX, drag.startY, event.clientX, event.clientY));
  };

  const onMouseUp = (event: React.MouseEvent) => {
    if (!drag) return;
    const next = normalizePickRegion(drag.startX, drag.startY, event.clientX, event.clientY);
    setDrag(null);
    setRegion(next);
    if (next.width >= MIN_SIZE && next.height >= MIN_SIZE) {
      void finish({ region: next, devicePixelRatio: dpr });
    }
  };

  return (
    <div
      className="sw-capture-root"
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
    >
      <div className="sw-capture-hint">
        Drag to select an area · Enter to capture · Esc to cancel
      </div>
      {region && region.width > 0 && region.height > 0 ? (
        <div
          className="sw-capture-selection"
          style={{
            left: region.x,
            top: region.y,
            width: region.width,
            height: region.height,
          }}
        />
      ) : null}
    </div>
  );
}
