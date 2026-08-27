import { getTauriHotkeyAdapter } from '../platform';
import { isLiveTranslateActive, stopLiveTranslate } from './live-controller';

const LIVE_ESCAPE_STOP_ID = 'desktop-live-translate-escape';

/** Escape stops the overlay while live mode is active (registered only during a session). */
export async function registerLiveTranslateEscapeStop(): Promise<void> {
  if (!isLiveTranslateActive()) return;

  const adapter = getTauriHotkeyAdapter();
  await adapter.register(
    {
      id: LIVE_ESCAPE_STOP_ID,
      accelerator: 'Escape',
      description: 'Stop live translate overlay',
    },
    () => {
      if (isLiveTranslateActive()) {
        void stopLiveTranslate();
      }
    },
  );
}

export async function unregisterLiveTranslateEscapeStop(): Promise<void> {
  await getTauriHotkeyAdapter().unregister(LIVE_ESCAPE_STOP_ID);
}
