import { invoke } from '@tauri-apps/api/core';

export type DesktopOs = 'windows' | 'linux' | 'macos' | 'unknown';

let cached: Promise<DesktopOs> | null = null;

export function getDesktopOs(): Promise<DesktopOs> {
  if (!cached) {
    cached = invoke<DesktopOs>('get_os').catch(() => 'unknown' as const);
  }
  return cached;
}
