import { invoke } from '@tauri-apps/api/core';
import { requestRegionSelection } from '../capture/region-picker-store';
import { focusCaptureWindow } from '../capture/capture-utils';
import { readLiveTranslateSettings } from './live-settings';
import {
  clearLiveRegionStore,
  cycleSavedLiveRegion,
  getActiveSavedRegion,
  readLiveRegionStore,
  rememberLiveRegion,
} from './live-region-store';
import { translateOcrLines } from './live-translate.service';
import { filterStableOcrLines } from './live-stability';
import { resolveLivePollIntervalMs } from './live-poll-interval';
import {
  clearPersistedLiveRegion,
  hideLiveOverlay,
  persistLiveRegion,
  regionFromPicker,
  showLiveOverlay,
} from './live-overlay-manager';
import type { LiveRegion, LiveScanResult, LiveTranslatedLine, OcrLineBox } from './types';

type StabilityEntry = {
  text: string;
  hits: number;
};

let active = false;
let loopTimer: number | null = null;
let currentRegion: LiveRegion | null = null;
let lastError: string | null = null;
let lastEngineUsed: string | null = null;
const stability = new Map<string, StabilityEntry>();

function stableLines(lines: OcrLineBox[]): OcrLineBox[] {
  const { stableLines: nextStable, nextState } = filterStableOcrLines(lines, stability);
  stability.clear();
  nextState.forEach((entry, key) => stability.set(key, entry));
  return nextStable;
}

function buildTranslatedLines(
  lines: OcrLineBox[],
  translations: Map<string, string>,
): LiveTranslatedLine[] {
  return lines.map((line, index) => ({
    id: `${Math.round(line.y)}-${index}-${line.text.slice(0, 12)}`,
    sourceText: line.text,
    translatedText: translations.get(line.text.trim()) ?? line.text,
    x: line.x,
    y: line.y,
    width: line.width,
    height: line.height,
  }));
}

function regionStatusMessage(): string | null {
  const store = readLiveRegionStore();
  if (store.regions.length <= 1) return null;
  return `Region ${store.activeIndex + 1}/${store.regions.length}`;
}

async function applyRegion(region: LiveRegion): Promise<void> {
  currentRegion = region;
  rememberLiveRegion(region);
  await persistLiveRegion(region);
  stability.clear();
}

async function tick(): Promise<void> {
  if (!active || !currentRegion) return;

  const settings = readLiveTranslateSettings();

  try {
    const scan = await invoke<LiveScanResult>('live_scan');
    if (scan.frameUnchanged) return;

    const lines = stableLines(scan.lines);
    const regionHint = regionStatusMessage();

    if (lines.length === 0) {
      await showLiveOverlay({
        active: true,
        region: currentRegion,
        lines: [],
        overlayOpacity: settings.overlayOpacity,
        fontScale: settings.fontScale,
        engineUsed: lastEngineUsed,
        statusMessage: null,
        regionLabel: regionHint,
      });
      return;
    }

    const { translations, engineUsed, rateLimited } = await translateOcrLines(
      lines,
      settings.targetLanguage,
      settings.sourceLanguage,
      settings.maxRequestsPerMinute,
      settings.translationEngine,
      settings.lingvaBaseUrl,
      settings.localLibreTranslateUrl,
      settings.autoFallback,
    );

    if (engineUsed) {
      lastEngineUsed = engineUsed;
    }

    const overlayLines = buildTranslatedLines(lines, translations);
    await showLiveOverlay({
      active: true,
      region: currentRegion,
      lines: overlayLines,
      overlayOpacity: settings.overlayOpacity,
      fontScale: settings.fontScale,
      engineUsed: engineUsed ?? lastEngineUsed,
      statusMessage: rateLimited ? 'Rate limited — waiting' : null,
      regionLabel: rateLimited ? null : regionHint,
    });
    lastError = null;
  } catch (error) {
    lastError = error instanceof Error ? error.message : String(error);
    await showLiveOverlay({
      active: true,
      region: currentRegion,
      lines: [],
      overlayOpacity: settings.overlayOpacity,
      fontScale: settings.fontScale,
      engineUsed: lastEngineUsed,
      statusMessage: lastError,
    });
  }
}

function startLoop(): void {
  stopLoop();
  const settings = readLiveTranslateSettings();
  const pollIntervalMs = resolveLivePollIntervalMs(
    settings.translationEngine,
    settings.pollIntervalMs,
  );
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
}

async function ensureRegion(forcePick: boolean): Promise<LiveRegion | null> {
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

export async function startLiveTranslate(forceRegionPick = false): Promise<boolean> {
  if (active) return true;

  const available = await invoke<boolean>('live_is_available');
  if (!available) {
    lastError = 'Windows OCR is not available on this system.';
    return false;
  }

  const region = await ensureRegion(forceRegionPick);
  if (!region) return false;

  active = true;
  lastError = null;
  stability.clear();
  startLoop();
  return true;
}

export async function stopLiveTranslate(): Promise<void> {
  active = false;
  stopLoop();
  stability.clear();
  await hideLiveOverlay();
  await focusCaptureWindow();
}

export async function toggleLiveTranslate(forceRegionPick = false): Promise<boolean> {
  if (active) {
    await stopLiveTranslate();
    return false;
  }
  return startLiveTranslate(forceRegionPick);
}

export async function cycleLiveTranslateRegion(delta: -1 | 1): Promise<boolean> {
  const next = cycleSavedLiveRegion(delta);
  if (!next) {
    lastError = 'No saved regions yet. Pick a region first.';
    return false;
  }

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

export function getLiveTranslateRegion(): LiveRegion | null {
  return currentRegion;
}

export function getLiveRegionStoreState() {
  return readLiveRegionStore();
}
