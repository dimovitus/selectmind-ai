import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { Card, CardContent, CardHeader, CardTitle } from '@/presentation/components/ui/card';
import { Button } from '@/presentation/components/ui/button';
import { AppSelect } from '@/presentation/components/ui/select';
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
import { probeLiveContinuousCaptureAvailable } from '../live/live-continuous-support';
import { DesktopOfflineModelsSettings } from './DesktopOfflineModelsSettings';
import { listInstalledOcrLanguages } from '../live/live-ocr-languages';
import { getDesktopOs, type DesktopOs } from '../platform/os';
import {
  clearLiveDiagnostics,
  formatLiveDiagnosticsForCopy,
  getLiveDiagnostics,
} from '../live/live-diagnostics';

function normalizeOcrTag(tag: string): string {
  return tag.trim().toLowerCase().replace('_', '-');
}

function isOcrLanguageInstalled(selected: string, installed: string[]): boolean {
  if (selected === 'auto') return installed.length > 0;
  const want = normalizeOcrTag(selected);
  return installed.some(
    (tag) => normalizeOcrTag(tag) === want || normalizeOcrTag(tag).startsWith(`${want}-`),
  );
}

export function DesktopLiveTranslateSettings() {
  const [settings, setSettings] = useState<LiveTranslateSettings>(() => readLiveTranslateSettings());
  const [ocrAvailable, setOcrAvailable] = useState<boolean | null>(null);
  const [desktopOs, setDesktopOs] = useState<DesktopOs | null>(null);
  const [continuousCaptureOk, setContinuousCaptureOk] = useState<boolean | null>(null);
  const [installedOcrLanguages, setInstalledOcrLanguages] = useState<string[]>([]);
  const [regionStore, setRegionStore] = useState(() => readLiveRegionStore());
  const [librePingStatus, setLibrePingStatus] = useState<string | null>(null);
  const [librePingPending, setLibrePingPending] = useState(false);
  const [cacheStats, setCacheStats] = useState(() => getTranslationCacheStats());
  const [diagnosticsCopied, setDiagnosticsCopied] = useState(false);
  const [diagnosticsCount, setDiagnosticsCount] = useState(() => getLiveDiagnostics().length);

  useEffect(() => {
    void invoke<boolean>('live_is_available')
      .then(setOcrAvailable)
      .catch(() => setOcrAvailable(false));
    void getDesktopOs().then(setDesktopOs);
    void probeLiveContinuousCaptureAvailable()
      .then(setContinuousCaptureOk)
      .catch(() => setContinuousCaptureOk(false));
    void listInstalledOcrLanguages()
      .then(setInstalledOcrLanguages)
      .catch(() => setInstalledOcrLanguages([]));
  }, []);

  useEffect(() => {
    const refreshDiagnosticsCount = () => setDiagnosticsCount(getLiveDiagnostics().length);
    refreshDiagnosticsCount();
    const unlisten = listen('live:state-changed', refreshDiagnosticsCount);
    return () => {
      void unlisten.then((dispose) => dispose());
    };
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

  async function copyDiagnostics() {
    const text = formatLiveDiagnosticsForCopy();
    try {
      await navigator.clipboard.writeText(text);
      setDiagnosticsCopied(true);
      setDiagnosticsCount(getLiveDiagnostics().length);
      window.setTimeout(() => setDiagnosticsCopied(false), 2500);
    } catch {
      window.prompt('Copy live translate diagnostics:', text);
    }
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
          Press <strong>{liveHotkey}</strong> (or the toolbar button) to translate. In on-demand mode
          the same key clears the overlay; in continuous mode it stops scanning. Esc cancels region
          selection. Cycle saved regions with <strong>{prevRegionHotkey}</strong> /{' '}
          <strong>{nextRegionHotkey}</strong>.
        </p>
        <p className="rounded-md border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-xs text-sky-100">
          For games, <strong>Offline NMT (Argos)</strong> or a local LibreTranslate server is the
          most reliable option — free web endpoints often rate-limit mid-session.
        </p>
        <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          Competitive games with anti-cheat may flag screen capture or overlays. Use in single-player /
          offline games. Exclusive fullscreen may block the overlay — prefer borderless windowed.
        </p>
        {ocrAvailable === false ? (
          <p className="text-xs text-red-400">
            {desktopOs === 'linux'
              ? 'Tesseract OCR is unavailable. Install tesseract and language packs (pacman -S tesseract tesseract-data-eng tesseract-data-rus).'
              : 'Windows OCR is unavailable. Install a Windows OCR language pack in Settings → Time & language.'}
          </p>
        ) : null}

        <details className="rounded-md border px-3 py-2 text-xs text-muted-foreground">
          <summary className="cursor-pointer font-medium text-foreground">How live translate works</summary>
          <ul className="mt-2 list-disc space-y-1 pl-4">
            <li>
              <strong>On demand (default):</strong> press the hotkey once — full-screen OCR + translate. Press again
              to clear (RetroArch-style).
            </li>
            <li>
              <strong>Continuous:</strong> keeps scanning until you stop. Limit OCR to dialogue or top band for
              speed.
            </li>
            <li>
              <strong>Regions:</strong> optional saved areas via Pick new region — hotkey always uses full screen unless
              you explicitly pick a region.
            </li>
            <li>
              <strong>Engines:</strong> offline Argos or local LibreTranslate are most reliable; free web endpoints may
              rate-limit.
            </li>
            <li>
              <strong>Stop:</strong> press the hotkey again, or <strong>Esc</strong> while the overlay is active.
            </li>
            <li>
              <strong>Gaming:</strong> borderless windowed, single-player recommended. See repo docs{' '}
              <code className="text-foreground">docs/DESKTOP_LIVE_TRANSLATE.md</code>.
            </li>
          </ul>
        </details>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-2">
          <label className="text-xs font-medium text-foreground">Continuous Live Translate</label>
          <AppSelect
            className="mt-1"
            aria-label="Continuous Live Translate"
            value={settings.triggerMode}
            onChange={(nextMode) =>
              update({
                triggerMode: nextMode as LiveTranslateSettings['triggerMode'],
              })
            }
            options={[
              { value: 'on-demand', label: 'Off — one hotkey press, then clear' },
              { value: 'continuous', label: 'On — keep updating until you stop' },
            ]}
          />
          <p className="mt-1 text-[11px] text-muted-foreground">
            {desktopOs === 'linux' ? (
              continuousCaptureOk === true ? (
                <>
                  Also toggle from the system tray or the overlay pill. Continuous uses a PipeWire stream
                  (share-screen dialog once).
                </>
              ) : (
                <>
                  Continuous needs <code className="text-foreground">gst-plugin-pipewire</code>. Tray toggle
                  still flips the preference — restart after:{' '}
                  <code className="text-foreground">sudo pacman -S gst-plugin-pipewire</code>. Probe:{' '}
                  {continuousCaptureOk === null ? 'checking…' : 'plugin not detected yet'}.
                </>
              )
            ) : (
              <>Also toggle from the system tray or the overlay pill. Prefer Offline NMT for Continuous.</>
            )}
          </p>
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs text-muted-foreground">Full-screen scan area (continuous only)</label>
          <AppSelect
            className="mt-1"
            aria-label="Full-screen scan area"
            value={settings.scanFocus}
            onChange={(nextFocus) =>
              update({ scanFocus: nextFocus as LiveTranslateSettings['scanFocus'] })
            }
            disabled={settings.triggerMode !== 'continuous'}
            options={[
              { value: 'dialogue-band', label: 'Dialogue band — bottom ~42% (subtitles, faster)' },
              { value: 'top-band', label: 'Top band — upper ~35% (menus / HUD, faster)' },
              { value: 'full', label: 'Full screen — all UI text (slower)' },
            ]}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Hotkey on-demand always scans the full screen once. Continuous mode can limit OCR to the
            subtitle strip to reduce load and flicker.
          </p>
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs text-muted-foreground">Translation engine</label>
            <AppSelect
              className="mt-1"
              aria-label="Translation engine"
              value={settings.translationEngine}
              onChange={(nextEngine) =>
                update({
                  translationEngine: nextEngine as LiveTranslateSettings['translationEngine'],
                })
              }
              options={LIVE_TRANSLATION_ENGINE_OPTIONS.map((option) => ({
                value: option.id,
                label: option.label,
              }))}
            />
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
              Auto-fallback when the primary engine fails (Google/Bing → Offline reserve; Offline → Google;
              LibreTranslate → Google). Offline reserve shows a yellow frame on the overlay.
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
            <label className="text-xs text-muted-foreground">
              {desktopOs === 'linux' ? 'OCR language (Tesseract)' : 'OCR language (Windows)'}
            </label>
            <AppSelect
              className="mt-1"
              aria-label="OCR language"
              value={settings.ocrLanguage}
              onChange={(nextLanguage) => update({ ocrLanguage: nextLanguage })}
              options={[
                {
                  value: 'auto',
                  label:
                    desktopOs === 'linux'
                      ? 'Auto — installed Tesseract languages'
                      : 'Auto — Windows profile languages',
                },
                ...RESPONSE_LANGUAGE_OPTIONS.filter((option) => option.code !== 'auto').map(
                  (option) => ({
                    value: option.code,
                    label: option.label,
                  }),
                ),
              ]}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              {desktopOs === 'linux'
                ? 'Language pack Tesseract should read on screen. Auto / English also include Russian when installed — otherwise Cyrillic becomes Latin lookalikes (кракозябры). Install tesseract-data-eng / tesseract-data-rus.'
                : 'Which language Windows OCR reads on screen. Match the game UI (English for most imports). Install matching packs in Settings → Time & language if OCR finds nothing.'}
              {installedOcrLanguages.length > 0 ? (
                <>
                  {' '}
                  Installed OCR packs:{' '}
                  <span className="text-foreground">{installedOcrLanguages.join(', ')}</span>.
                </>
              ) : null}
              {settings.ocrLanguage !== 'auto' &&
              installedOcrLanguages.length > 0 &&
              !isOcrLanguageInstalled(settings.ocrLanguage, installedOcrLanguages) ? (
                <span className="block text-amber-300">
                  Selected OCR language may not be installed — native OCR will fall back to default languages.
                </span>
              ) : null}
            </p>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Translate source language</label>
            <AppSelect
              className="mt-1"
              aria-label="Translate source language"
              value={settings.sourceLanguage}
              onChange={(nextLanguage) => update({ sourceLanguage: nextLanguage })}
              options={[
                { value: 'auto', label: 'Auto-detect' },
                ...RESPONSE_LANGUAGE_OPTIONS.filter((option) => option.code !== 'auto').map(
                  (option) => ({
                    value: option.code,
                    label: option.label,
                  }),
                ),
              ]}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Used by translation APIs only (not OCR). Auto works for online engines; offline models
              need an exact pair.
            </p>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Target language</label>
            <AppSelect
              className="mt-1"
              aria-label="Target language"
              value={settings.targetLanguage}
              onChange={(nextLanguage) => update({ targetLanguage: nextLanguage })}
              options={RESPONSE_LANGUAGE_OPTIONS.filter((option) => option.code !== 'auto').map(
                (option) => ({
                  value: option.code,
                  label: option.label,
                }),
              )}
            />
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
              Used only in continuous mode. Online engines default to 450 ms; offline engines use 300
              ms when left at the online default.
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
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void copyDiagnostics()}
          >
            {diagnosticsCopied ? 'Copied!' : 'Copy diagnostics'}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              clearLiveDiagnostics();
              setDiagnosticsCopied(false);
              setDiagnosticsCount(0);
            }}
          >
            Clear diagnostics log
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Translation cache: {cacheStats.count}/{cacheStats.maxEntries} entries · TTL {cacheStats.ttlHours}h
          {' · '}
          Diagnostics: {diagnosticsCount} local tick(s) — never sent online
        </p>
      </CardContent>
    </Card>
  );
}
