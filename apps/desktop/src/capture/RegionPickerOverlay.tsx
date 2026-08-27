import { useCallback, useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { emit, listen } from '@tauri-apps/api/event';
import { normalizePickRegion } from './overlay-pick';
import type { RegionPickerResult } from './region-picker-store';
import './capture.css';

const MIN_SIZE = 24;

type PickerSelection = Pick<RegionPickerResult, 'region' | 'devicePixelRatio'>;

async function loadPreviewFrame(): Promise<string> {
  return invoke<string>('capture_last_surface');
}

export function CaptureOverlayApp() {
  const [previewDataUrl, setPreviewDataUrl] = useState('');
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [region, setRegion] = useState<RegionPickerResult['region'] | null>(null);
  const [drag, setDrag] = useState<{ startX: number; startY: number } | null>(null);
  const dpr = window.devicePixelRatio || 1;

  const finish = useCallback(async (result: PickerSelection | null) => {
    setRegion(null);
    setDrag(null);
    await emit('capture:picker-done', {
      result: result
        ? {
            ...result,
            viewportWidth: window.innerWidth,
            viewportHeight: window.innerHeight,
          }
        : null,
    });
  }, []);

  const refreshPreview = useCallback(async (): Promise<boolean> => {
    try {
      const url = await loadPreviewFrame();
      setPreviewDataUrl(url);
      setPreviewError(null);
      setRegion(null);
      setDrag(null);
      return true;
    } catch (error) {
      setPreviewDataUrl('');
      setPreviewError(error instanceof Error ? error.message : String(error));
      return false;
    }
  }, []);

  useEffect(() => {
    document.documentElement.classList.add('capture-overlay');
    let gotFrame = false;

    const unlistenPing = listen('capture:overlay-ping', () => {
      void emit('capture:overlay-ready');
    });
    const unlistenStart = listen<{ clear?: boolean }>('capture:overlay-start', (event) => {
      if (event.payload.clear) {
        gotFrame = false;
        setPreviewDataUrl('');
        setPreviewError(null);
        setRegion(null);
        setDrag(null);
        return;
      }
      void refreshPreview().then((ok) => {
        if (ok) gotFrame = true;
      });
    });

    // Cold start: webview may miss the first overlay-start event. Poll until a frame exists.
    void emit('capture:overlay-ready');
    void refreshPreview().then((ok) => {
      if (ok) gotFrame = true;
    });
    const poll = window.setInterval(() => {
      if (!gotFrame) {
        void refreshPreview().then((ok) => {
          if (ok) gotFrame = true;
        });
      }
    }, 250);
    const stopPoll = window.setTimeout(() => window.clearInterval(poll), 5000);

    return () => {
      document.documentElement.classList.remove('capture-overlay');
      window.clearInterval(poll);
      window.clearTimeout(stopPoll);
      void unlistenPing.then((unlisten) => unlisten());
      void unlistenStart.then((unlisten) => unlisten());
    };
  }, [refreshPreview]);

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

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button === 2) {
      event.preventDefault();
      void finish(null);
      return;
    }
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrag({ startX: event.clientX, startY: event.clientY });
    setRegion(normalizePickRegion(event.clientX, event.clientY, event.clientX, event.clientY));
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!drag) return;
    setRegion(normalizePickRegion(drag.startX, drag.startY, event.clientX, event.clientY));
  };

  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!drag) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    const next = normalizePickRegion(drag.startX, drag.startY, event.clientX, event.clientY);
    setDrag(null);
    setRegion(next);
    if (next.width >= MIN_SIZE && next.height >= MIN_SIZE) {
      void finish({ region: next, devicePixelRatio: dpr });
    }
  };

  return (
    <div
      className={`sw-capture-root${region ? ' has-selection' : ''}`}
      onContextMenu={(event) => event.preventDefault()}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        setDrag(null);
        setRegion(null);
      }}
    >
      {previewDataUrl ? (
        <img className="sw-capture-preview" src={previewDataUrl} alt="" draggable={false} />
      ) : (
        <div className="sw-capture-loading">
          {previewError
            ? `Capture failed: ${previewError}`
            : 'Capturing screen… allow the portal prompt if shown'}
        </div>
      )}
      <div className="sw-capture-hint">
        Drag to select an area · Esc or right-click to cancel
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
