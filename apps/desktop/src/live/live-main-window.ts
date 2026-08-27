import { PhysicalPosition } from '@tauri-apps/api/dpi';

let restorePosition: { x: number; y: number } | null = null;

/** Move the main window off-screen so full-screen OCR does not read our UI. */
export async function tuckMainWindowForLive(): Promise<void> {
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    const window = getCurrentWindow();
    const pos = await window.outerPosition();
    restorePosition = { x: pos.x, y: pos.y };
    await window.setPosition(new PhysicalPosition(-8000, -8000));
  } catch {
    restorePosition = null;
  }
}

export async function restoreMainWindowFromLive(): Promise<void> {
  if (!restorePosition) return;
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    const window = getCurrentWindow();
    await window.setPosition(new PhysicalPosition(restorePosition.x, restorePosition.y));
  } catch {
    // ignore
  } finally {
    restorePosition = null;
  }
}
