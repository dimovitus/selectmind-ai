export interface RegionPickerResult {
  region: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  devicePixelRatio: number;
  monitor: {
    x: number;
    y: number;
    width: number;
    height: number;
    scaleFactor: number;
  };
}

let picking = false;
const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((listener) => listener());
}

export function subscribeRegionPicker(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function isRegionPickerActive(): boolean {
  return picking;
}

export async function requestRegionSelection(): Promise<RegionPickerResult | null> {
  const { requestRegionSelection: requestOverlayPick } = await import('./overlay-pick');
  picking = true;
  notify();
  try {
    return await requestOverlayPick();
  } finally {
    picking = false;
    notify();
  }
}
