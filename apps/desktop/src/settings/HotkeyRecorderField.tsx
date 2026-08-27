import { useEffect, useState } from 'react';
import { Button } from '@/presentation/components/ui/button';
import {
  formatAcceleratorDisplay,
  getHotkeyAccelerator,
  getHotkeyDefinition,
  keyboardEventToAccelerator,
  resetHotkeyBinding,
  subscribeHotkeySettings,
  type DesktopHotkeyId,
  writeHotkeyBinding,
} from './desktop-hotkeys';
import { syncDesktopHotkeys } from '../shell/init-desktop-hotkeys';

interface HotkeyRecorderFieldProps {
  hotkeyId: DesktopHotkeyId;
  onChange?: () => void;
}

export function HotkeyRecorderField({ hotkeyId, onChange }: HotkeyRecorderFieldProps) {
  const definition = getHotkeyDefinition(hotkeyId);
  const [accelerator, setAccelerator] = useState(() => getHotkeyAccelerator(hotkeyId));
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setAccelerator(getHotkeyAccelerator(hotkeyId));
  }, [hotkeyId]);

  useEffect(() => {
    return subscribeHotkeySettings(() => {
      setAccelerator(getHotkeyAccelerator(hotkeyId));
      setRecording(false);
      setError(null);
    });
  }, [hotkeyId]);

  useEffect(() => {
    if (!recording) return;

    const onKeyDown = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();

      if (event.key === 'Escape') {
        setRecording(false);
        setError(null);
        return;
      }

      const next = keyboardEventToAccelerator(event);
      if (!next) return;

      try {
        writeHotkeyBinding(hotkeyId, next);
        setAccelerator(next);
        setError(null);
        setRecording(false);
        void syncDesktopHotkeys();
        onChange?.();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Invalid shortcut');
      }
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [hotkeyId, onChange, recording]);

  const handleReset = () => {
    resetHotkeyBinding(hotkeyId);
    setAccelerator(getHotkeyAccelerator(hotkeyId));
    setError(null);
    void syncDesktopHotkeys();
    onChange?.();
  };

  return (
    <div className="space-y-1.5 rounded-md border border-border/60 bg-muted/20 px-3 py-2.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">{definition.label}</p>
          <p className="text-xs text-muted-foreground">{definition.description}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            variant={recording ? 'secondary' : 'outline'}
            size="sm"
            className="h-8 min-w-[9rem] font-mono text-xs"
            onClick={() => {
              setError(null);
              setRecording(true);
            }}
          >
            {recording ? 'Press keys…' : formatAcceleratorDisplay(accelerator)}
          </Button>
          <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={handleReset}>
            Reset
          </Button>
        </div>
      </div>
      {recording ? (
        <p className="text-xs text-muted-foreground">Press the new shortcut. Esc cancels.</p>
      ) : null}
      {error ? <p className="text-xs text-red-400">{error}</p> : null}
    </div>
  );
}
