import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { initDesktopApp } from './di/container';
import { Workspace } from './Workspace';
import { initDesktopSystemTray } from './shell/init-system-tray';
import { hideMainWindowToTray } from './shell/tray-window';
import { initDesktopAutostart } from './shell/sync-autostart';
import { initSelectionMonitor } from './selection/init-selection-monitor';

type LoadState = 'loading' | 'ready' | 'error';

function formatError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return 'Init failed';
  }
}

export function App() {
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      try {
        await initDesktopApp();
        await initDesktopSystemTray();
        await initDesktopAutostart();
        initSelectionMonitor();
        const minimized = await invoke<boolean>('should_start_minimized');
        if (minimized) {
          await hideMainWindowToTray(getCurrentWindow());
        }
        if (cancelled) return;
        setLoadState('ready');
        setBootstrapError(null);
      } catch (error) {
        if (cancelled) return;
        setLoadState('error');
        setBootstrapError(formatError(error));
      }
    }

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loadState === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Loading SelectMind…
      </div>
    );
  }

  if (loadState === 'error') {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-3 p-6">
        <h1 className="text-lg font-semibold">Failed to start</h1>
        <p className="text-sm text-red-400">{bootstrapError}</p>
      </div>
    );
  }

  return <AppReady />;
}

function AppReady() {
  return <Workspace />;
}
