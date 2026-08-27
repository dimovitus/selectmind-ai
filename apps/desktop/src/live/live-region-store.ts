import { readJson, writeJson } from '../storage/local-store';
import type { LiveRegion } from './types';

const LIVE_REGIONS_STORAGE_KEY = 'live-translate-regions';
export const MAX_SAVED_LIVE_REGIONS = 5;

export interface LiveRegionStoreState {
  regions: LiveRegion[];
  activeIndex: number;
}

const EMPTY_STORE: LiveRegionStoreState = {
  regions: [],
  activeIndex: 0,
};

function regionKey(region: LiveRegion): string {
  return [
    region.monitorX,
    region.monitorY,
    region.x,
    region.y,
    region.width,
    region.height,
    region.scaleFactor,
  ].join(':');
}

function isValidLiveRegion(value: unknown): value is LiveRegion {
  if (!value || typeof value !== 'object') return false;
  const region = value as Record<string, unknown>;
  const numbers = ['monitorX', 'monitorY', 'x', 'y', 'width', 'height', 'scaleFactor'] as const;
  if (!numbers.every((key) => typeof region[key] === 'number' && Number.isFinite(region[key]))) {
    return false;
  }
  return (region.width as number) > 0 && (region.height as number) > 0 && (region.scaleFactor as number) > 0;
}

export function readLiveRegionStore(): LiveRegionStoreState {
  const stored = readJson<Partial<LiveRegionStoreState>>(LIVE_REGIONS_STORAGE_KEY, {});
  const regions = Array.isArray(stored.regions)
    ? stored.regions.filter(isValidLiveRegion).slice(0, MAX_SAVED_LIVE_REGIONS)
    : [];
  const activeIndex =
    typeof stored.activeIndex === 'number' && regions.length > 0
      ? Math.min(Math.max(0, stored.activeIndex), regions.length - 1)
      : 0;

  return {
    regions,
    activeIndex: regions.length > 0 ? activeIndex : 0,
  };
}

function writeLiveRegionStore(state: LiveRegionStoreState): LiveRegionStoreState {
  writeJson(LIVE_REGIONS_STORAGE_KEY, state);
  return state;
}

export function getActiveSavedRegion(): LiveRegion | null {
  const store = readLiveRegionStore();
  return store.regions[store.activeIndex] ?? store.regions[0] ?? null;
}

export function rememberLiveRegion(region: LiveRegion): LiveRegionStoreState {
  const store = readLiveRegionStore();
  const key = regionKey(region);
  const withoutDuplicate = store.regions.filter((entry) => regionKey(entry) !== key);
  const regions = [region, ...withoutDuplicate].slice(0, MAX_SAVED_LIVE_REGIONS);

  return writeLiveRegionStore({
    regions,
    activeIndex: 0,
  });
}

export function cycleSavedLiveRegion(delta: -1 | 1): LiveRegion | null {
  const store = readLiveRegionStore();
  if (store.regions.length === 0) return null;

  const nextIndex =
    (store.activeIndex + delta + store.regions.length) % store.regions.length;

  const updated = writeLiveRegionStore({
    ...store,
    activeIndex: nextIndex,
  });

  return updated.regions[updated.activeIndex] ?? null;
}

export function clearLiveRegionStore(): void {
  writeLiveRegionStore(EMPTY_STORE);
}

export function formatLiveRegionLabel(region: LiveRegion, index: number): string {
  return `#${index + 1} · ${Math.round(region.width)}×${Math.round(region.height)} @ (${Math.round(region.x)}, ${Math.round(region.y)})`;
}
