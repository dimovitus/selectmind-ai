import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Card, CardContent, CardHeader, CardTitle } from '@/presentation/components/ui/card';
import { Button } from '@/presentation/components/ui/button';
import {
  DEFAULT_LIVE_TRANSLATE_SETTINGS,
  LIVE_TRANSLATION_ENGINE_OPTIONS,
  readLiveTranslateSettings,
  writeLiveTranslateSettings,
  type LiveTranslateSettings,
} from '../live/live-settings';
import {
  formatLiveRegionLabel,
  MAX_SAVED_LIVE_REGIONS,
  readLiveRegionStore,
} from '../live/live-region-store';
import { RESPONSE_LANGUAGE_OPTIONS } from '@/shared/constants/response-languages';
import { clearTranslationCache, getTranslationCacheStats } from '../live/translation-cache';
import {
  formatAcceleratorDisplay,
  getHotkeyAccelerator,
  LIVE_REGION_NEXT_HOTKEY_ID,
  LIVE_REGION_PREV_HOTKEY_ID,
  LIVE_TRANSLATE_HOTKEY_ID,
} from './desktop-hotkeys';
import {
  cycleLiveTranslateRegion,
  getLiveRegionStoreState,
  pickNewLiveTranslateRegion,
  resetLiveTranslateRegion,
} from '../live/live-controller';
import { DesktopOfflineModelsSettings } from './DesktopOfflineModelsSettings';

export function DesktopLiveTranslateSettings() {
  const [settings, setSettings] = useState<LiveTranslateSettings>(() => readLiveTranslateSettings());
  const [ocrAvailable, setOcrAvailable] = useState<boolean | null>(null);
  const [regionStore, setRegionStore] = useState(() => readLiveRegionStore());
  const [librePingStatus, setLibrePingStatus] = useState<string | null>(null);
  const [librePingPending, setLibrePingPending] = useState(false);
  const [cacheStats, setCacheStats] = useState(() => getTranslationCacheStats());

  useEffect(() => {
    void invoke<boolean>('live_is_available')
      .then(setOcrAvailable)
      .catch(() => setOcrAvailable(false));
  }, []);

  const liveHotkey = formatAcceleratorDisplay(getHotkeyAccelerator(LIVE_TRANSLATE_HOTKEY_ID));
  const prevRegionHotkey = formatAcceleratorDisplay(getHotkeyAccelerator(LIVE_REGION_PREV_HOTKEY_ID));
  const nextRegionHotkey = formatAcceleratorDisplay(getHotkeyAccelerator(LIVE_REGION_NEXT_HOTKEY_ID));

  function refreshRegionStore() {
    setRegionStore(getLiveRegionStoreState());
  }

  function update(partial: Partial<LiveTranslateSettings>) {
    const next = writeLiveTranslateSettings(partial);
    setSettings(next);
  }

  async function testLibreTranslateConnection() {
    setLibrePingPending(true);
    setLibrePingStatus(null);
    try {
      const message = await invoke<string>('translate_ping_local', {
        baseUrl: settings.localLibreTranslateUrl,
      });
      setLibrePingStatus(message);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setLibrePingStatus(message);
    } finally {
      setLibrePingPending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Live game translate</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Pick a screen region once, then toggle live OCR translation overlay with{' '}
          <strong>{liveHotkey}</strong>. Cycle saved regions with{' '}
          <strong>{prevRegionHotkey}</strong> / <strong>{nextRegionHotkey}</strong>.
        </p>
        <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          Competitive games with anti-cheat may flag screen capture or overlays. Use in single-player /
          offline games. Exclusive fullscreen may block the overlay — prefer borderless windowed.
        </p>
        {ocrAvailable === false ? (
          <p className="text-xs text-red-400">
            Windows OCR is unavailable. Install a Windows OCR language pack in Settings → Time &amp; language.
          </p>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="text-xs text-muted-foreground">Translation engine</label>
            <select
              className="mt-1 w-full rounded-md border bg-background px-3 py-1.5 text-sm"
              value={settings.translationEngine}
              onChange={(event) =>
                update({
                  translationEngine: event.target.value as LiveTranslateSettings['translationEngine'],
                })
              }
            >
              {LIVE_TRANSLATION_ENGINE_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-muted-foreground">
              {
                LIVE_TRANSLATION_ENGINE_OPTIONS.find((option) => option.id === settings.translationEngine)
                  ?.description
              }
            </p>
          </div>
          <div className="sm:col-span-2 flex items-center gap-2">
            <input
              id="live-auto-fallback"
              type="checkbox"
              checked={settings.autoFallback}
              onChange={(event) => update({ autoFallback: event.target.checked })}
              disabled={settings.translationEngine === 'ai-provider'}
            />
            <label htmlFor="live-auto-fallback" className="text-xs text-muted-foreground">
              Auto-fallback to other engines when the primary one fails (Offline → Bing → Google; Bing → Google →
              Lingva; LibreTranslate → Google)
            </label>
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs text-muted-foreground">Lingva proxy URL</label>
            <input
              className="mt-1 w-full rounded-md border bg-background px-3 py-1.5 text-sm"
              value={settings.lingvaBaseUrl}
              onChange={(event) => update({ lingvaBaseUrl: event.target.value })}
              placeholder="https://lingva.ml"
              disabled={settings.translationEngine === 'ai-provider' || settings.translationEngine === 'local-nmt'}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs text-muted-foreground">LibreTranslate server URL</label>
            <div className="mt-1 flex flex-wrap gap-2">
              <input
                className="min-w-0 flex-1 rounded-md border bg-background px-3 py-1.5 text-sm"
                value={settings.localLibreTranslateUrl}
                onChange={(event) => {
                  setLibrePingStatus(null);
                  update({ localLibreTranslateUrl: event.target.value });
                }}
                placeholder="http://127.0.0.1:5000"
                disabled={settings.translationEngine !== 'local-libretranslate'}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={settings.translationEngine !== 'local-libretranslate' || librePingPending}
                onClick={() => void testLibreTranslateConnection()}
              >
                {librePingPending ? 'Testing…' : 'Test connection'}
              </Button>
            </div>
            {librePingStatus ? (
              <p
                className={`mt-1 text-xs ${
                  librePingStatus.includes('reachable') ? 'text-green-400' : 'text-red-400'
                }`}
              >
                {librePingStatus}
              </p>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">
                Run LibreTranslate locally, then select the LibreTranslate engine above. Example:{' '}
                <code className="text-foreground">docker run -p 5000:5000 libretranslate/libretranslate</code>
              </p>
            )}
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Source language</label>
            <select
              className="mt-1 w-full rounded-md border bg-background px-3 py-1.5 text-sm"
              value={settings.sourceLanguage}
              onChange={(event) => update({ sourceLanguage: event.target.value })}
            >
              <option value="auto">Auto-detect</option>
              {RESPONSE_LANGUAGE_OPTIONS.filter((option) => option.code !== 'auto').map((option) => (
                <option key={option.code} value={option.code}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-muted-foreground">
              Use English for most game subtitles. Auto-detect works for online engines; offline models need an exact
              pair.
            </p>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Target language</label>
            <select
              className="mt-1 w-full rounded-md border bg-background px-3 py-1.5 text-sm"
              value={settings.targetLanguage}
              onChange={(event) => update({ targetLanguage: event.target.value })}
            >
              {RESPONSE_LANGUAGE_OPTIONS.filter((option) => option.code !== 'auto').map((option) => (
                <option key={option.code} value={option.code}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Poll interval (ms)</label>
            <input
              type="number"
              min={250}
              max={2000}
              step={50}
              className="mt-1 w-full rounded-md border bg-background px-3 py-1.5 text-sm"
              value={settings.pollIntervalMs}
              onChange={(event) =>
                update({ pollIntervalMs: Number(event.target.value) || DEFAULT_LIVE_TRANSLATE_SETTINGS.pollIntervalMs })
              }
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Online engines default to 450 ms (~2.2 fps). Offline engines use 300 ms when left at the online default.
            </p>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Overlay opacity</label>
            <input
              type="number"
              min={0.4}
              max={1}
              step={0.05}
              className="mt-1 w-full rounded-md border bg-background px-3 py-1.5 text-sm"
              value={settings.overlayOpacity}
              onChange={(event) =>
                update({ overlayOpacity: Number(event.target.value) || DEFAULT_LIVE_TRANSLATE_SETTINGS.overlayOpacity })
              }
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Font scale</label>
            <input
              type="number"
              min={0.7}
              max={1.6}
              step={0.05}
              className="mt-1 w-full rounded-md border bg-background px-3 py-1.5 text-sm"
              value={settings.fontScale}
              onChange={(event) =>
                update({ fontScale: Number(event.target.value) || DEFAULT_LIVE_TRANSLATE_SETTINGS.fontScale })
              }
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs text-muted-foreground">Max translation requests / minute</label>
            <input
              type="number"
              min={5}
              max={120}
              step={1}
              className="mt-1 w-full rounded-md border bg-background px-3 py-1.5 text-sm"
              value={settings.maxRequestsPerMinute}
              onChange={(event) =>
                update({
                  maxRequestsPerMinute:
                    Number(event.target.value) || DEFAULT_LIVE_TRANSLATE_SETTINGS.maxRequestsPerMinute,
                })
              }
            />
          </div>
        </div>

        <DesktopOfflineModelsSettings />

        <div className="rounded-md border px-3 py-2 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">
            Saved regions ({regionStore.regions.length}/{MAX_SAVED_LIVE_REGIONS})
          </p>
          {regionStore.regions.length === 0 ? (
            <p className="mt-1">No regions saved yet. Toggle live translate and pick an area on screen.</p>
          ) : (
            <ul className="mt-2 space-y-1">
              {regionStore.regions.map((region, index) => (
                <li
                  key={`${region.x}-${region.y}-${index}`}
                  className={index === regionStore.activeIndex ? 'text-foreground' : ''}
                >
                  {formatLiveRegionLabel(region, index)}
                  {index === regionStore.activeIndex ? ' · active' : ''}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              void cycleLiveTranslateRegion(-1).then(refreshRegionStore);
            }}
          >
            Previous region
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              void cycleLiveTranslateRegion(1).then(refreshRegionStore);
            }}
          >
            Next region
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              void pickNewLiveTranslateRegion().then(refreshRegionStore);
            }}
          >
            Pick new region
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              void resetLiveTranslateRegion().then(refreshRegionStore);
            }}
          >
            Reset saved regions
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              clearTranslationCache();
              setCacheStats(getTranslationCacheStats());
            }}
          >
            Clear translation cache
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Translation cache: {cacheStats.count}/{cacheStats.maxEntries} entries · TTL {cacheStats.ttlHours}h
        </p>
      </CardContent>
    </Card>
  );
}
