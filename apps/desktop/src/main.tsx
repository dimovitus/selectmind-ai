import { StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { App } from './App';
import { CaptureOverlayApp } from './capture/RegionPickerOverlay';
import { SelectionOverlayApp } from './selection/SelectionOverlayApp';
import './app.css';

async function bootstrap() {
  const label = getCurrentWindow().label;
  const params = new URLSearchParams(window.location.search);
  const overlay = params.get('overlay');

  let content: ReactNode = <App />;
  if (label === 'capture-overlay' || overlay === 'capture') {
    content = <CaptureOverlayApp />;
  } else if (label === 'selection-overlay' || overlay === 'selection') {
    content = <SelectionOverlayApp />;
  }

  createRoot(document.getElementById('root')!).render(<StrictMode>{content}</StrictMode>);
}

void bootstrap();
