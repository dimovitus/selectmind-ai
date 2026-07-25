export function formatUnknownError(error: unknown, fallback: string): string {
  if (error instanceof Error) return error.message || fallback;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return fallback;
  }
}

async function tryWindowOp(label: string, operation: () => Promise<void>): Promise<void> {
  try {
    await operation();
  } catch (error) {
    console.warn(`Window ${label} failed:`, error);
  }
}

export async function focusCaptureWindow(): Promise<void> {
  const { getCurrentWindow } = await import('@tauri-apps/api/window');
  const window = getCurrentWindow();
  await tryWindowOp('show', () => window.show());
  await tryWindowOp('unminimize', () => window.unminimize());
  await tryWindowOp('setFocus', () => window.setFocus());
}

export async function waitForOverlayDismiss(): Promise<void> {
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
  await new Promise<void>((resolve) => setTimeout(resolve, 50));
}
