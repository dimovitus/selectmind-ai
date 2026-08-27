import { invoke } from '@tauri-apps/api/core';
import type { DesktopOs } from '../platform/os';

let cachedProbe: Promise<boolean> | null = null;

/** Runtime probe: GStreamer pipewiresrc present (Linux) or always true elsewhere. */
export function probeLiveContinuousCaptureAvailable(): Promise<boolean> {
  if (!cachedProbe) {
    cachedProbe = invoke<boolean>('live_continuous_capture_available').catch(() => false);
  }
  return cachedProbe;
}

/** Invalidate after documenting a plugin install so settings can re-probe. */
export function invalidateContinuousCaptureProbe(): void {
  cachedProbe = null;
}

/**
 * Continuous needs a real screen stream. On Linux that is GStreamer pipewiresrc
 * via portal ScreenCast; without the plugin, keep Continuous disabled.
 */
export function isLiveContinuousCaptureReady(
  os: DesktopOs,
  captureAvailable: boolean | null,
): boolean {
  if (os !== 'linux') return true;
  return captureAvailable === true;
}

export async function startContinuousCapture(): Promise<void> {
  await invoke('live_start_continuous_capture');
}

export async function stopContinuousCapture(): Promise<void> {
  await invoke('live_stop_continuous_capture').catch(() => {});
}
