import { invoke } from '@tauri-apps/api/core';
import { requestRegionSelection } from '../capture/region-picker-store';
import { focusCaptureWindow } from '../capture/capture-utils';
import {
  formatAcceleratorDisplay,
  getHotkeyAccelerator,
  LIVE_TRANSLATE_HOTKEY_ID,
} from '../settings/desktop-hotkeys';
import { resolveEffectiveTranslationEngine } from './live-engine-resolve';
import { resolveLiveOcrLanguageTag } from './live-ocr-language';
import { readLiveTranslateSettings, writeLiveTranslateSettings, type LiveCoverageMode, type LiveScanFocus, type LiveTriggerMode } from './live-settings';
import { startContinuousCapture, stopContinuousCapture } from './live-continuous-support';
import { isOfflineReserveUsed } from './engine-label';
import { offsetOcrLines, resolveScanRegion } from './live-scan-region';
import {
  clearLiveRegionStore,
  cycleSavedLiveRegion,
  getActiveSavedRegion,
  readLiveRegionStore,
  rememberLiveRegion,
} from './live-region-store';
import { translateOcrLines } from './live-translate.service';
import { buildOverlayLinesFromSourceLines } from './live-overlay-display';
import { partitionLinesForTranslate } from './live-translate-partition';
import { filterStableOcrLines, isLikelyOverlayEcho, isReadableOcrLine, textsSimilar } from './live-stability';
import { textMatchesTargetScript } from './live-script';
import { resolveLivePollIntervalMs } from './live-poll-interval';
import {
  clearPersistedLiveRegion,
  hideLiveOverlay,
  LIVE_STATUS_STRIP_CSS_PX,
  persistLiveRegion,
  prewarmLiveOverlay,
  regionFromPicker,
  setLiveOverlayCaptureShield,
  showLiveOverlay,
} from './live-overlay-manager';
import { emitLiveStateChanged } from './live-state';
import {
  buildTickStatus,
  describeEmptyScan,
  isBlankFrame,
  shortenError,
} from './live-scan-diagnostics';
import { recordLiveTick } from './live-diagnostics';
import {
  registerLiveTranslateEscapeStop,
  unregisterLiveTranslateEscapeStop,
} from './live-escape-hotkey';
import { tuckMainWindowForLive, restoreMainWindowFromLive } from './live-main-window';
import type {
  LiveOverlayPayload,
  LiveRegion,
  LiveScanResult,
  LiveTranslatedLine,
  OcrLineBox,
} from './types';

type StabilityEntry = {
  text: string;
  hits: number;
};

/** Empty scans tolerated before telling the user the region has no text. */
const EMPTY_SCANS_BEFORE_HINT = 4;
/** Blank frames tolerated before we stop trusting capture exclusion. */
const BLANK_FRAMES_BEFORE_SHIELD_DROP = 3;
/** Scans a vanished line keeps rendering, so brief OCR misses do not blink. */
const LINE_MISS_TOLERANCE = 2;
/**
 * Free engines pack ~25 lines into one HTTP request, so a full screen costs a
 * handful of round trips. The cap is only a guard against pathological OCR
 * output (hundreds of noise fragments) blowing past the tick timeout.
 */
const MAX_LIVE_TRANSLATE_LINES = 120;

let active = false;
/** Prevents overlapping start/stop from double tray/hotkey fires. */
let startInFlight = false;
let loopTimer: number | null = null;
let tickInFlight = false;
let currentRegion: LiveRegion | null = null;
let lastError: string | null = null;
let lastEngineUsed: string | null = null;
let lastScanLines: OcrLineBox[] = [];
let lastDisplayedTexts: string[] = [];
let lastOverlayLines: LiveTranslatedLine[] = [];
let emptyScans = 0;
let blankFrames = 0;
let captureShieldActive = false;
let currentCoverage: LiveCoverageMode = 'screen';
/** Effective trigger for this session (Linux may coerce continuous → on-demand). */
let sessionTriggerMode: LiveTriggerMode = 'on-demand';
/** Bumped on stop so in-flight ticks cannot repaint the overlay. */
let tickGeneration = 0;
const stability = new Map<string, StabilityEntry>();

type PersistedLine = { line: LiveTranslatedLine; misses: number };
/** Last rendered line per position bucket, kept alive through brief OCR misses. */
const linePersistence = new Map<string, PersistedLine>();

/**
 * Blend the current scan with recently vanished lines. A line missing from one
 * or two scans keeps rendering, so individual boxes stop blinking on and off.
 */
function mergeWithPersistence(current: LiveTranslatedLine[]): LiveTranslatedLine[] {
  const currentIds = new Set(current.map((line) => line.id));
  for (const line of current) {
    linePersistence.set(line.id, { line, misses: 0 });
  }
  for (const [id, entry] of Array.from(linePersistence)) {
    if (currentIds.has(id)) continue;
    entry.misses += 1;
    if (entry.misses > LINE_MISS_TOLERANCE) {
      linePersistence.delete(id);
    }
  }
  return Array.from(linePersistence.values()).map((entry) => entry.line);
}

function clearLinePersistence(): void {
  linePersistence.clear();
}

interface MonitorInfoDto {
  x: number;
  y: number;
  width: number;
  height: number;
  scaleFactor: number;
}

/** RetroArch-style coverage: the monitor under the game window (or cursor fallback). */
async function fullMonitorRegion(): Promise<LiveRegion> {
  const monitor = await invoke<MonitorInfoDto>('get_foreground_monitor_info');
  const scale = monitor.scaleFactor > 0 ? monitor.scaleFactor : 1;
  return {
    monitorX: monitor.x,
    monitorY: monitor.y,
    x: 0,
    y: 0,
    width: Math.floor(monitor.width / scale),
    height: Math.floor(monitor.height / scale),
    scaleFactor: scale,
  };
}

function stableLines(lines: OcrLineBox[]): OcrLineBox[] {
  const { stableLines: nextStable, nextState } = filterStableOcrLines(lines, stability);
  stability.clear();
  nextState.forEach((entry, key) => stability.set(key, entry));
  return nextStable;
}

/** Map last overlay boxes into the capture bitmap (band scans need a Y shift). */
function buildOverlayMaskRects(
  lines: LiveTranslatedLine[],
  yOffsetPhysical: number,
): Array<{ x: number; y: number; width: number; height: number }> {
  if (lines.length === 0) return [];
  return lines
    .map((line) => ({
      x: line.x,
      y: line.y - yOffsetPhysical,
      width: line.width,
      height: line.height,
    }))
    .filter((rect) => rect.width > 1 && rect.height > 1);
}

/**
 * Without capture exclusion the OCR pass can read the overlay's own output.
 * Drop anything that looks like text we just rendered.
 */
function rejectSelfRenderedLines(lines: OcrLineBox[]): OcrLineBox[] {
  if (lastDisplayedTexts.length === 0) return lines;
  return lines.filter(
    (line) => !lastDisplayedTexts.some((shown) => isLikelyOverlayEcho(shown, line.text)),
  );
}

/** On-demand hotkey scans the whole screen; continuous can use dialogue/top bands. */
function scanFocusForTick(settings: ReturnType<typeof readLiveTranslateSettings>): LiveScanFocus {
  if (currentCoverage !== 'screen') return 'full';
  if (sessionTriggerMode === 'on-demand') return 'full';
  return settings.scanFocus;
}

function logTickDiagnostic(
  _settings: ReturnType<typeof readLiveTranslateSettings>,
  scanFocus: LiveScanFocus,
  scan: LiveScanResult | null,
  params: {
    stableLineCount?: number;
    overlayLineCount?: number;
    engineUsed?: string | null;
    rateLimited?: boolean;
    cacheHitRatio?: number;
    error?: string | null;
  },
): void {
  recordLiveTick({
    at: Date.now(),
    coverage: currentCoverage,
    triggerMode: sessionTriggerMode,
    scanFocus,
    frameUnchanged: scan?.frameUnchanged ?? false,
    rawLineCount: scan?.rawLineCount ?? scan?.lines.length ?? 0,
    stableLineCount: params.stableLineCount ?? 0,
    overlayLineCount: params.overlayLineCount ?? 0,
    engineUsed: params.engineUsed ?? lastEngineUsed,
    meanLuma: scan?.meanLuma ?? 0,
    lumaRange: scan?.lumaRange ?? 0,
    width: scan?.width ?? 0,
    height: scan?.height ?? 0,
    ocrLanguage: scan?.ocrLanguage ?? '',
    rateLimited: params.rateLimited ?? false,
    roiAreaPct: scan?.roiAreaPct ?? 0,
    ocrScope: scan?.ocrScope ?? 'full',
    cacheHitRatio: params.cacheHitRatio ?? 0,
    error: params.error ?? null,
  });
}

function regionStatusMessage(): string | null {
  const store = readLiveRegionStore();
  if (store.regions.length <= 1) return null;
  return `Region ${store.activeIndex + 1}/${store.regions.length}`;
}

function liveCancelHint(): string {
  const key = formatAcceleratorDisplay(getHotkeyAccelerator(LIVE_TRANSLATE_HOTKEY_ID));
  return sessionTriggerMode === 'on-demand' ? `${key} — clear` : `${key} — stop`;
}

function buildOverlayPayload(
  region: LiveRegion,
  lines: LiveTranslatedLine[],
  status: { message: string | null; tone: 'info' | 'warn' | null },
): LiveOverlayPayload {
  const settings = readLiveTranslateSettings();
  const isScreen = currentCoverage === 'screen';
  const offlineReserve = isOfflineReserveUsed(lastEngineUsed);
  return {
    active: true,
    region,
    lines,
    overlayOpacity: settings.overlayOpacity,
    fontScale: settings.fontScale,
    engineUsed: lastEngineUsed,
    statusMessage: status.message,
    statusTone: status.tone ?? (offlineReserve ? 'warn' : null),
    regionLabel: isScreen ? null : regionStatusMessage(),
    showFrame: !isScreen,
    coverage: currentCoverage,
    cancelHint: liveCancelHint(),
    statusStripPx: isScreen ? 0 : LIVE_STATUS_STRIP_CSS_PX,
    animatePosition: sessionTriggerMode === 'continuous',
    continuousMode: sessionTriggerMode === 'continuous',
    offlineReserve,
  };
}

async function showStatusOnly(
  message: string | null,
  tone: 'info' | 'warn' | null,
): Promise<void> {
  if (!currentRegion) return;
  lastDisplayedTexts = [];
  await showLiveOverlay(buildOverlayPayload(currentRegion, [], { message, tone }));
}

/**
 * Capture exclusion is unavailable on a few configurations and can yield blank
 * frames. Detect that and fall back to hiding the overlay during scans.
 */
async function recoverFromBlankCapture(scan: LiveScanResult): Promise<void> {
  if (!captureShieldActive || scan.frameUnchanged) return;

  if (!isBlankFrame(scan)) {
    blankFrames = 0;
    return;
  }

  blankFrames += 1;
  if (blankFrames < BLANK_FRAMES_BEFORE_SHIELD_DROP) return;

  await setLiveOverlayCaptureShield(false);
  captureShieldActive = false;
  blankFrames = 0;
}

async function applyRegion(region: LiveRegion, remember = true): Promise<void> {
  currentRegion = region;
  if (remember) {
    rememberLiveRegion(region);
  }
  await persistLiveRegion(region);
  stability.clear();
  clearLinePersistence();
  lastScanLines = [];
  lastDisplayedTexts = [];
  lastOverlayLines = [];
  emptyScans = 0;
  blankFrames = 0;
}

function isTickStale(generation: number): boolean {
  return !active || generation !== tickGeneration;
}

function emptyScanStatus(scan: LiveScanResult): string {
  if (sessionTriggerMode === 'on-demand' || emptyScans >= EMPTY_SCANS_BEFORE_HINT) {
    return describeEmptyScan(scan);
  }
  return 'Scanning…';
}

async function tick(): Promise<void> {
  if (!active || !currentRegion || tickInFlight) return;
  tickInFlight = true;
  const generation = tickGeneration;
  liveStep('tick begin');

  const settings = readLiveTranslateSettings();

  try {
    const scanFocus = scanFocusForTick(settings);
    const { region: scanRegion, yOffsetPhysical } = resolveScanRegion(currentRegion, {
      coverage: currentCoverage,
      scanFocus,
    });
    await persistLiveRegion(scanRegion);
    if (isTickStale(generation)) return;

    // Linux has no WDA_EXCLUDEFROMCAPTURE — keep the overlay visible and paint
    // black over last boxes in the capture buffer (software mask). Windows with
    // a working shield never needs hide-for-scan either.
    const maskRects = buildOverlayMaskRects(lastOverlayLines, yOffsetPhysical);
    if (!captureShieldActive) {
      liveStep(`software mask rects=${maskRects.length} (skip hide+settle)`);
    }

    const ocrTag = resolveLiveOcrLanguageTag(settings.ocrLanguage, settings.sourceLanguage);
    liveStep(`live_scan (ocr=${ocrTag})`);
    let scan = await invoke<LiveScanResult>('live_scan', {
      args: { ocrLanguage: ocrTag, maskRects },
    });
    liveStep(
      `scan done lines=${scan.lines.length} blank=${isBlankFrame(scan)} unchanged=${scan.frameUnchanged}`,
    );
    if (isTickStale(generation)) return;

    if (isBlankFrame(scan) && captureShieldActive) {
      await setLiveOverlayCaptureShield(false);
      captureShieldActive = false;
      liveStep('blank frame with shield — retry without shield');
      scan = await invoke<LiveScanResult>('live_scan', {
        args: { ocrLanguage: ocrTag, maskRects },
      });
      if (isTickStale(generation)) return;
    }

    await recoverFromBlankCapture(scan);

    let ocrLines: OcrLineBox[];
    if (scan.frameUnchanged) {
      ocrLines = lastScanLines;
    } else {
      lastScanLines = offsetOcrLines(rejectSelfRenderedLines(scan.lines), yOffsetPhysical);
      ocrLines = lastScanLines;
    }

    const stable = stableLines(ocrLines).filter((line) =>
      isReadableOcrLine(line.text.trim()),
    );
    // Translate each OCR line on its own bbox so UI labels stay pinned to the
    // text they replace (paragraph merge was smearing one translation across
    // unrelated buttons/rows).
    const translateLines = [...stable]
      .sort((a, b) => a.y - b.y || a.x - b.x)
      .slice(0, MAX_LIVE_TRANSLATE_LINES);
    // Already-target-script text (e.g. Russian UI with target=ru) must not get
    // opaque overlay boxes — that looks like a broken "half translation".
    const overlayLinesSource = translateLines.filter(
      (line) => !textMatchesTargetScript(line.text.trim(), settings.targetLanguage),
    );
    const continuous = sessionTriggerMode === 'continuous';
    liveStep(
      `stable=${stable.length} translateCandidates=${translateLines.length} paint=${overlayLinesSource.length} roi=${(scan.roiAreaPct ?? 0).toFixed(0)}% scope=${scan.ocrScope ?? 'full'}`,
    );

    if (overlayLinesSource.length === 0) {
      emptyScans += 1;
      const carried = continuous ? mergeWithPersistence([]) : [];
      if (carried.length > 0) {
        lastOverlayLines = carried;
        lastDisplayedTexts = carried.map((line) => line.translatedText);
        if (isTickStale(generation)) return;
        await showLiveOverlay(
          buildOverlayPayload(currentRegion, carried, { message: null, tone: null }),
        );
        logTickDiagnostic(settings, scanFocus, scan, {
          stableLineCount: stable.length,
          overlayLineCount: carried.length,
        });
        return;
      }
      lastOverlayLines = [];
      if (isTickStale(generation)) return;
      await showStatusOnly(
        translateLines.length > 0
          ? 'Nothing to translate — text already looks like the target language'
          : emptyScanStatus(scan),
        'info',
      );
      logTickDiagnostic(settings, scanFocus, scan, { stableLineCount: 0, overlayLineCount: 0 });
      return;
    }

    emptyScans = 0;

    const targetLanguage = settings.targetLanguage;
    const partition = partitionLinesForTranslate(overlayLinesSource, targetLanguage);
    const allCached = partition.pendingCount === 0;
    const partitionTotal = partition.cachedCount + partition.pendingCount;
    const cacheHitRatio = partitionTotal > 0 ? partition.cachedCount / partitionTotal : 1;
    liveStep(
      `cacheHit=${(cacheHitRatio * 100).toFixed(0)}% network=${partition.pendingCount} cached=${partition.cachedCount}`,
    );

    // Optimistic paint: cache hits immediately; pending stay as source until
    // the network returns (or times out). Never hide cached lines behind a stall.
    if (!allCached && partition.cachedCount > 0) {
      if (isTickStale(generation)) return;
      const built = buildOverlayLinesFromSourceLines(
        overlayLinesSource,
        partition.resolved,
        linePersistence,
        { showSourceOnMiss: true, textsSimilar },
      );
      const provisional = continuous ? mergeWithPersistence(built) : built;
      lastOverlayLines = provisional;
      lastDisplayedTexts = provisional.map((line) => line.translatedText);
      await showLiveOverlay(
        buildOverlayPayload(currentRegion, provisional, {
          message: 'Translating…',
          tone: 'info',
        }),
      );
    } else if (!allCached) {
      if (isTickStale(generation)) return;
      const built = buildOverlayLinesFromSourceLines(
        overlayLinesSource,
        new Map(),
        linePersistence,
        { showSourceOnMiss: true, textsSimilar },
      );
      const provisional = continuous ? mergeWithPersistence(built) : built;
      lastOverlayLines = provisional;
      lastDisplayedTexts = provisional.map((line) => line.translatedText);
      await showLiveOverlay(
        buildOverlayPayload(currentRegion, provisional, {
          message: 'Translating…',
          tone: 'info',
        }),
      );
    }

    const translationEngine = await resolveEffectiveTranslationEngine(settings);
    liveStep(
      allCached
        ? `translate ${partition.cachedCount} lines (all cached)`
        : `translate network=${partition.pendingCount} cached=${partition.cachedCount} via ${translationEngine}`,
    );
    /** Prefer 0% stall over waiting on Google — miss lines fall back or stay source. */
    const translateTimeoutMs = 4_000;
    let translations: Map<string, string>;
    let engineUsed: string | null;
    let rateLimited: boolean;
    try {
      if (allCached) {
        translations = partition.resolved;
        engineUsed = 'cache';
        rateLimited = false;
      } else {
        // Only miss lines hit the engine — ROI-stable text stays on the cache path.
        const translated = await Promise.race([
          translateOcrLines(
            partition.pendingLines,
            settings.targetLanguage,
            settings.sourceLanguage,
            settings.maxRequestsPerMinute,
            translationEngine,
            settings.lingvaBaseUrl,
            settings.localLibreTranslateUrl,
            settings.autoFallback,
          ),
          new Promise<never>((_, reject) => {
            window.setTimeout(
              () => reject(new Error('Translation timed out — trying offline reserve')),
              translateTimeoutMs,
            );
          }),
        ]);
        translations = new Map(partition.resolved);
        for (const [source, value] of translated.translations) {
          translations.set(source, value);
        }
        engineUsed = translated.engineUsed ?? (partition.cachedCount > 0 ? 'cache' : null);
        rateLimited = translated.rateLimited;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      liveStep(`translate FAILED: ${message}`);
      translations = new Map(partition.resolved);
      engineUsed = null;
      rateLimited = true;

      // Network hang → local-nmt for remaining misses (if installed).
      if (
        translationEngine !== 'local-nmt' &&
        settings.autoFallback &&
        partition.pendingLines.length > 0
      ) {
        try {
          liveStep('translate fallback → local-nmt');
          const fallback = await Promise.race([
            translateOcrLines(
              partition.pendingLines,
              settings.targetLanguage,
              settings.sourceLanguage,
              settings.maxRequestsPerMinute,
              'local-nmt',
              settings.lingvaBaseUrl,
              settings.localLibreTranslateUrl,
              false,
            ),
            new Promise<never>((_, reject) => {
              window.setTimeout(
                () => reject(new Error('Offline reserve timed out')),
                translateTimeoutMs,
              );
            }),
          ]);
          for (const [source, value] of fallback.translations) {
            translations.set(source, value);
          }
          if (fallback.engineUsed) {
            engineUsed = `${translationEngine}→${fallback.engineUsed}`;
            rateLimited = false;
          }
        } catch (fallbackError) {
          const fallbackMessage =
            fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
          liveStep(`local-nmt fallback FAILED: ${fallbackMessage}`);
        }
      }

      for (const line of partition.pendingLines) {
        const source = line.text.trim();
        if (source && !translations.has(source)) {
          translations.set(source, source);
        }
      }
    }
    liveStep(`translate done engine=${engineUsed ?? 'none'} rateLimited=${rateLimited}`);

    if (engineUsed) {
      lastEngineUsed = engineUsed;
    }

    const offlineReserve = isOfflineReserveUsed(engineUsed ?? lastEngineUsed);
    const built = buildOverlayLinesFromSourceLines(overlayLinesSource, translations, linePersistence, {
      showSourceOnMiss: true,
      textsSimilar,
    });
    const overlayLines = continuous ? mergeWithPersistence(built) : built;
    lastDisplayedTexts = overlayLines.map((line) => line.translatedText);
    lastOverlayLines = overlayLines;

    if (isTickStale(generation)) return;
    await showLiveOverlay(
      buildOverlayPayload(currentRegion, overlayLines, {
        message: buildTickStatus(
          scan,
          overlayLines.length,
          engineUsed ?? lastEngineUsed,
          offlineReserve
            ? 'Offline reserve — network failed'
            : rateLimited
              ? 'Engine slow — showing original text'
              : null,
          offlineReserve || rateLimited ? 'warn' : 'info',
        ),
        tone: offlineReserve || rateLimited ? 'warn' : null,
      }),
    );
    lastError = null;
    logTickDiagnostic(settings, scanFocus, scan, {
      stableLineCount: stable.length,
      overlayLineCount: overlayLines.length,
      engineUsed: engineUsed ?? lastEngineUsed,
      rateLimited,
      cacheHitRatio,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    lastError = shortenError(message);
    logTickDiagnostic(settings, scanFocusForTick(settings), null, {
      overlayLineCount: lastOverlayLines.length,
      error: lastError,
    });
    if (isTickStale(generation)) return;
    // Keep the last translations on screen; a transient error should not
    // wipe every box for one tick.
    if (currentRegion && lastOverlayLines.length > 0) {
      await showLiveOverlay(
        buildOverlayPayload(currentRegion, lastOverlayLines, {
          message: lastError,
          tone: 'warn',
        }),
      );
    } else {
      await showStatusOnly(lastError, 'warn');
    }
  } finally {
    if (generation === tickGeneration) {
      tickInFlight = false;
    }
  }
}

function startLoop(): void {
  stopLoop();
  const settings = readLiveTranslateSettings();
  const base = resolveLivePollIntervalMs(settings.translationEngine, settings.pollIntervalMs);
  // Full-monitor OCR is much heavier than a subtitle strip — poll slower.
  const pollIntervalMs = currentCoverage === 'screen' ? Math.max(base, 650) : base;
  loopTimer = window.setInterval(() => {
    void tick();
  }, pollIntervalMs);
  void tick();
}

function stopLoop(): void {
  if (loopTimer !== null) {
    window.clearInterval(loopTimer);
    loopTimer = null;
  }
  tickInFlight = false;
}

async function ensureRegion(forcePick: boolean): Promise<LiveRegion | null> {
  if (currentCoverage === 'screen' && !forcePick) {
    const region = await fullMonitorRegion();
    await applyRegion(region, false);
    return region;
  }

  if (!forcePick) {
    const saved = currentRegion ?? getActiveSavedRegion();
    if (saved) {
      await applyRegion(saved);
      return saved;
    }
  }

  const picked = await requestRegionSelection();
  if (!picked) {
    await focusCaptureWindow();
    return null;
  }

  const region = regionFromPicker(picked);
  await applyRegion(region);
  return region;
}

export function isLiveTranslateActive(): boolean {
  return active;
}

export function getLiveTranslateError(): string | null {
  return lastError;
}

function liveStep(name: string): void {
  console.warn(`[selectmind] live: ${name}`);
}

export async function startLiveTranslate(forceRegionPick = false): Promise<boolean> {
  if (active) return true;
  if (startInFlight) {
    liveStep('start ignored (already starting)');
    return false;
  }
  startInFlight = true;
  liveStep('start');

  try {
    const available = await invoke<boolean>('live_is_available');
    liveStep(`available=${available}`);
    if (!available) {
      lastError =
        'Native OCR is not available. On Linux install tesseract and language packs; on Windows install an OCR language pack.';
      liveStep(`abort: ${lastError}`);
      return false;
    }

    // The hotkey/button always translates the whole screen; region coverage is
    // only used when the user explicitly picks an area in settings.
    currentCoverage = forceRegionPick ? 'region' : 'screen';

    const settingsAtStart = readLiveTranslateSettings();
    sessionTriggerMode = settingsAtStart.triggerMode;
    // Always attempt Continuous when chosen; stream start falls back to on-demand.

    const region = await ensureRegion(forceRegionPick);
    if (!region) {
      liveStep('abort: no region');
      return false;
    }
    liveStep(
      `region ${region.width}x${region.height}@${region.monitorX},${region.monitorY}`,
    );

    let tucked = false;

    try {
      if (currentCoverage === 'screen') {
        await tuckMainWindowForLive();
        tucked = true;
        liveStep('main tucked');
      }

      if (sessionTriggerMode === 'continuous') {
        liveStep('starting continuous capture stream');
        try {
          await startContinuousCapture();
          liveStep('continuous capture ready');
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          liveStep(`continuous capture failed: ${message} — falling back to on-demand`);
          sessionTriggerMode = 'on-demand';
          lastError = shortenError(
            `Continuous capture unavailable: ${message}. Ran one-shot instead.`,
          );
        }
      }

      captureShieldActive = await setLiveOverlayCaptureShield(true);
      liveStep(`captureShield=${captureShieldActive}`);

      active = true;
      lastError = null;
      stability.clear();
      clearLinePersistence();
      lastScanLines = [];
      lastDisplayedTexts = [];
      lastOverlayLines = [];
      emptyScans = 0;
      blankFrames = 0;

      await emitLiveStateChanged(true);
      await prewarmLiveOverlay(
        buildOverlayPayload(region, [], { message: 'Scanning…', tone: 'info' }),
      );
      liveStep('overlay prewarmed');

      if (sessionTriggerMode === 'on-demand') {
        // One-shot: scan + translate once, keep the overlay until the hotkey/button is pressed again.
        liveStep('on-demand tick');
        await tick();
        // tick() may set lastError after live:state-changed(true) — re-emit so
        // Workspace can surface OCR/translate failures from the hotkey path.
        if (lastError) {
          liveStep(`tick error: ${lastError}`);
          await emitLiveStateChanged(true);
          // Bring the main window back so the error is not trapped off-screen
          // when the overlay status pill is invisible (WebKitGTK transparency).
          if (tucked && lastOverlayLines.length === 0) {
            await restoreMainWindowFromLive();
            tucked = false;
            liveStep('main restored after error');
          }
        } else {
          liveStep('tick done');
        }
      } else {
        liveStep('continuous loop');
        startLoop();
      }

      await registerLiveTranslateEscapeStop();
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      lastError = shortenError(message);
      liveStep(`start FAILED: ${lastError}`);
      active = false;
      if (captureShieldActive) {
        await setLiveOverlayCaptureShield(false);
        captureShieldActive = false;
      }
      await hideLiveOverlay().catch(() => {});
      if (tucked) {
        await restoreMainWindowFromLive();
      }
      await emitLiveStateChanged(false);
      return false;
    }
  } finally {
    startInFlight = false;
  }
}

export async function stopLiveTranslate(): Promise<void> {
  active = false;
  tickGeneration += 1;
  stopLoop();
  await stopContinuousCapture();
  stability.clear();
  clearLinePersistence();
  lastScanLines = [];
  lastDisplayedTexts = [];
  lastOverlayLines = [];
  emptyScans = 0;
  blankFrames = 0;
  if (captureShieldActive) {
    await setLiveOverlayCaptureShield(false);
    captureShieldActive = false;
  }
  await hideLiveOverlay();
  await unregisterLiveTranslateEscapeStop();
  await restoreMainWindowFromLive();
  await emitLiveStateChanged(false);
  await focusCaptureWindow();
}

export async function toggleLiveTranslate(forceRegionPick = false): Promise<boolean> {
  // Always allow cancel — startInFlight used to swallow stop and leave the
  // session stuck while Bing translated a huge OCR batch.
  if (active || startInFlight) {
    liveStep(active ? 'stop' : 'cancel start');
    startInFlight = false;
    await stopLiveTranslate();
    return false;
  }
  return startLiveTranslate(forceRegionPick);
}

/**
 * Tray / overlay shortcut: flip Continuous ↔ on-demand in settings.
 * If Live is already running, restart so the new trigger mode takes effect.
 */
export async function toggleContinuousLiveTranslate(): Promise<LiveTriggerMode> {
  const current = readLiveTranslateSettings();
  const nextMode: LiveTriggerMode =
    current.triggerMode === 'continuous' ? 'on-demand' : 'continuous';
  writeLiveTranslateSettings({ triggerMode: nextMode });
  liveStep(`continuous setting → ${nextMode}`);

  if (active || startInFlight) {
    startInFlight = false;
    await stopLiveTranslate();
    if (nextMode === 'continuous') {
      const started = await startLiveTranslate(false);
      if (!started) {
        // Keep the preference; stream failure already fell back / set lastError.
        liveStep('continuous restart failed — preference kept');
      }
    }
  }

  return nextMode;
}

export async function cycleLiveTranslateRegion(delta: -1 | 1): Promise<boolean> {
  const next = cycleSavedLiveRegion(delta);
  if (!next) {
    lastError = 'No saved regions yet. Pick a region first.';
    return false;
  }

  currentCoverage = 'region';
  await applyRegion(next);
  lastError = null;

  if (active) {
    await tick();
  }

  return true;
}

export async function pickNewLiveTranslateRegion(): Promise<boolean> {
  const wasActive = active;
  if (active) {
    await stopLiveTranslate();
  }

  const started = await startLiveTranslate(true);
  if (!started && wasActive) {
    await startLiveTranslate(false);
  }
  return started;
}

export async function resetLiveTranslateRegion(): Promise<boolean> {
  const wasActive = active;
  if (active) {
    await stopLiveTranslate();
  }
  currentRegion = null;
  clearLiveRegionStore();
  await clearPersistedLiveRegion();
  if (!wasActive) return true;
  return startLiveTranslate(true);
}

export function getLiveRegionStoreState() {
  return readLiveRegionStore();
}
