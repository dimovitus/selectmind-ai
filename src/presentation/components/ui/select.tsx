import { useEffect, useId, useRef, useState } from 'react';
import { cn } from '@/presentation/lib/utils';

export type AppSelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

interface AppSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: AppSelectOption[];
  className?: string;
  disabled?: boolean;
  id?: string;
  'aria-label'?: string;
}

/**
 * In-webview select. Native &lt;select&gt; on WebKitGTK opens a GTK popup that
 * ignores CSS (light system chrome) and paints outside the Tauri window.
 */
export function AppSelect({
  value,
  onChange,
  options,
  className,
  disabled,
  id,
  'aria-label': ariaLabel,
}: AppSelectProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const selected = options.find((option) => option.value === value);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        id={id}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        className={cn(
          'flex w-full items-center justify-between rounded-md border bg-background px-3 py-1.5 text-left text-sm',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50',
          className,
        )}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="min-w-0 truncate">{selected?.label ?? '—'}</span>
        <span className="ml-2 shrink-0 text-muted-foreground" aria-hidden>
          ▾
        </span>
      </button>
      {open ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-md border bg-card py-1 text-card-foreground shadow-lg"
        >
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <li key={option.value || '__empty'} role="option" aria-selected={isSelected}>
                <button
                  type="button"
                  disabled={option.disabled}
                  className={cn(
                    'w-full px-3 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground disabled:opacity-50',
                    isSelected && 'bg-accent text-accent-foreground',
                  )}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                >
                  {option.label}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
