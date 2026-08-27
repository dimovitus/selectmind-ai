import { StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { App } from './App';
import { CaptureOverlayApp } from './capture/RegionPickerOverlay';
import { SelectionOverlayApp } from './selection/SelectionOverlayApp';
import { LiveOverlayApp } from './live/LiveOverlayApp';
import { seedLiveTranslateSettingsIfNeeded } from './live/seed-live-settings';
import { initDesktopSystemTray } from './shell/init-system-tray';
import { registerDesktopTrayActions } from './shell/desktop-tray-actions';
import './app.css';

/** WebKitGTK console is invisible on Linux — mirror problems into `tauri dev` output. */
function bridgeConsoleToRust() {
  const forward = (level: string, args: unknown[]) => {
    try {
      const message = args
        .map((a) => (a instanceof Error ? `${a.message}\n${a.stack ?? ''}` : String(a)))
        .join(' ');
      void invoke('webview_log', { level, message }).catch(() => {});
    } catch {
      // Never let logging break the app.
    }
  };
  const error = console.error.bind(console);
  const warn = console.warn.bind(console);
  console.error = (...args: unknown[]) => {
    forward('error', args);
    error(...args);
  };
  console.warn = (...args: unknown[]) => {
    forward('warn', args);
    warn(...args);
  };
  window.addEventListener('error', (event) => {
    forward('uncaught', [event.error ?? event.message]);
  });
  window.addEventListener('unhandledrejection', (event) => {
    forward('unhandledrejection', [event.reason]);
  });
  return forward;
}

async function bootstrap() {
  const log = bridgeConsoleToRust();
  const label = getCurrentWindow().label;
  const params = new URLSearchParams(window.location.search);
  const overlay = params.get('overlay');
  log('info', [`bootstrap start (label=${label})`]);

  if (label === 'main') {
    // Register close→tray and tray action listeners before React bootstrap so
    // the menu works even while the UI is still loading (or blank).
    try {
      await seedLiveTranslateSettingsIfNeeded();
      log('info', ['live settings seed done']);
    } catch (error) {
      log('error', ['seedLiveTranslateSettingsIfNeeded failed:', error]);
    }
    try {
      await initDesktopSystemTray();
      log('info', ['system tray init done']);
    } catch (error) {
      log('error', ['initDesktopSystemTray failed:', error]);
    }
    try {
      await registerDesktopTrayActions();
      log('info', ['tray actions registered']);
    } catch (error) {
      log('error', ['registerDesktopTrayActions failed:', error]);
    }
  }

  let content: ReactNode = <App />;
  if (label === 'capture-overlay' || overlay === 'capture') {
    // Apply before React paints — otherwise body uses the opaque app background
    // and the overlay flashes as a solid black panel over the game.
    document.documentElement.classList.add('capture-overlay');
    content = <CaptureOverlayApp />;
  } else if (label === 'selection-overlay' || overlay === 'selection') {
    document.documentElement.classList.add('selection-overlay');
    content = <SelectionOverlayApp />;
  } else if (label === 'live-overlay' || overlay === 'live') {
    document.documentElement.classList.add('live-overlay');
    content = <LiveOverlayApp />;
  }

  createRoot(document.getElementById('root')!).render(<StrictMode>{content}</StrictMode>);
  log('info', ['react render started']);
}

void bootstrap();
