const MODIFIERS = new Set(['ctrl', 'control', 'alt', 'shift', 'meta', 'cmd', 'command']);

export interface ParsedHotkey {
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  meta: boolean;
  key: string;
}

export function parseHotkey(hotkey: string): ParsedHotkey | null {
  const parts = hotkey.toLowerCase().split('+').map((p) => p.trim());
  if (parts.length === 0) return null;

  const key = parts[parts.length - 1]!;
  const mods = parts.slice(0, -1);

  return {
    ctrl: mods.some((m) => m === 'ctrl' || m === 'control'),
    alt: mods.includes('alt'),
    shift: mods.includes('shift'),
    meta: mods.some((m) => m === 'meta' || m === 'cmd' || m === 'command'),
    key,
  };
}

export function matchesHotkey(event: KeyboardEvent, hotkey: string): boolean {
  const parsed = parseHotkey(hotkey);
  if (!parsed) return false;

  const eventKey = event.key.toLowerCase();

  if (parsed.ctrl !== event.ctrlKey) return false;
  if (parsed.alt !== event.altKey) return false;
  if (parsed.shift !== event.shiftKey) return false;
  if (parsed.meta !== event.metaKey) return false;

  return eventKey === parsed.key || event.code.toLowerCase() === `key${parsed.key}`;
}

export function formatHotkey(hotkey: string): string {
  return hotkey
    .replace(/Command/i, '⌘')
    .replace(/Ctrl/i, 'Ctrl')
    .replace(/Alt/i, 'Alt')
    .replace(/Shift/i, 'Shift');
}

export function isModifierKey(key: string): boolean {
  return MODIFIERS.has(key.toLowerCase());
}
