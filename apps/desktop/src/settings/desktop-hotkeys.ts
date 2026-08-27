import { readJson, writeJson } from '../storage/local-store';

export const OCR_CAPTURE_HOTKEY_ID = 'desktop-ocr-capture';
export const OCR_TOOLBAR_HOTKEY_ID = 'desktop-ocr-toolbar';
export const PALETTE_HOTKEY_ID = 'desktop-command-palette';
export const SELECTION_TOOLBAR_HOTKEY_ID = 'desktop-selection-toolbar';
export const LIVE_TRANSLATE_HOTKEY_ID = 'desktop-live-translate';
export const LIVE_REGION_PREV_HOTKEY_ID = 'desktop-live-region-prev';
export const LIVE_REGION_NEXT_HOTKEY_ID = 'desktop-live-region-next';

export type DesktopHotkeyId =
  | typeof OCR_CAPTURE_HOTKEY_ID
  | typeof OCR_TOOLBAR_HOTKEY_ID
  | typeof PALETTE_HOTKEY_ID
  | typeof SELECTION_TOOLBAR_HOTKEY_ID
  | typeof LIVE_TRANSLATE_HOTKEY_ID
  | typeof LIVE_REGION_PREV_HOTKEY_ID
  | typeof LIVE_REGION_NEXT_HOTKEY_ID;

export interface DesktopHotkeyDefinition {
  id: DesktopHotkeyId;
  defaultAccelerator: string;
  label: string;
  description: string;
}

export const DESKTOP_HOTKEY_DEFINITIONS: DesktopHotkeyDefinition[] = [
  {
    id: OCR_CAPTURE_HOTKEY_ID,
    defaultAccelerator: 'Ctrl+Shift+X',
    label: 'OCR chat',
    description: 'Capture a screen region and open an AI chat',
  },
  {
    id: OCR_TOOLBAR_HOTKEY_ID,
    defaultAccelerator: 'Ctrl+Shift+O',
    label: 'OCR toolbar',
    description: 'OCR a screen region and show the action toolbar',
  },
  {
    id: PALETTE_HOTKEY_ID,
    defaultAccelerator: 'Ctrl+Shift+P',
    label: 'Command palette',
    description: 'Open the command palette in SelectMind',
  },
  {
    id: SELECTION_TOOLBAR_HOTKEY_ID,
    defaultAccelerator: 'Ctrl+Shift+Space',
    label: 'Selection toolbar',
    description: 'Copy selected text and show the action toolbar (any app)',
  },
  {
    id: LIVE_TRANSLATE_HOTKEY_ID,
    defaultAccelerator: 'Ctrl+Shift+L',
    label: 'Live game translate',
    description: 'Translate the screen once (or toggle continuous live translate)',
  },
  {
    id: LIVE_REGION_PREV_HOTKEY_ID,
    defaultAccelerator: 'Ctrl+Shift+Left',
    label: 'Previous live region',
    description: 'Switch to the previous saved live translate capture region',
  },
  {
    id: LIVE_REGION_NEXT_HOTKEY_ID,
    defaultAccelerator: 'Ctrl+Shift+Right',
    label: 'Next live region',
    description: 'Switch to the next saved live translate capture region',
  },
];

const HOTKEYS_STORAGE_KEY = 'desktop-hotkeys';
const hotkeyListeners = new Set<() => void>();

type HotkeyBindings = Partial<Record<DesktopHotkeyId, string>>;

function notifyHotkeyListeners(): void {
  hotkeyListeners.forEach((listener) => listener());
}

function readHotkeyBindings(): HotkeyBindings {
  return readJson<HotkeyBindings>(HOTKEYS_STORAGE_KEY, {});
}

export function subscribeHotkeySettings(listener: () => void): () => void {
  hotkeyListeners.add(listener);
  return () => hotkeyListeners.delete(listener);
}

export function getHotkeyDefinition(id: DesktopHotkeyId): DesktopHotkeyDefinition {
  const definition = DESKTOP_HOTKEY_DEFINITIONS.find((entry) => entry.id === id);
  if (!definition) throw new Error(`Unknown hotkey id: ${id}`);
  return definition;
}

export function normalizeAccelerator(raw: string): string {
  return raw
    .split('+')
    .map((part) => {
      const token = part.trim();
      if (!token) return '';
      if (/^ctrl$/i.test(token) || /^control$/i.test(token)) return 'Ctrl';
      if (/^cmd$/i.test(token) || /^command$/i.test(token)) return 'Ctrl';
      if (/^alt$/i.test(token)) return 'Alt';
      if (/^shift$/i.test(token)) return 'Shift';
      if (/^meta$/i.test(token) || /^super$/i.test(token) || /^win$/i.test(token)) return 'Meta';
      if (/^space$/i.test(token)) return 'Space';
      if (/^esc$/i.test(token) || /^escape$/i.test(token)) return 'Escape';
      if (/^arrow(up|down|left|right)$/i.test(token)) {
        return token.replace(/^arrow/i, '');
      }
      if (token.length === 1) return token.toUpperCase();
      if (/^f\d{1,2}$/i.test(token)) return token.toUpperCase();
      if (token.length > 1) {
        return `${token.charAt(0).toUpperCase()}${token.slice(1)}`;
      }
      return token;
    })
    .filter(Boolean)
    .join('+');
}

export function formatAcceleratorDisplay(accelerator: string): string {
  return normalizeAccelerator(accelerator).replace(/\+/g, ' + ');
}

export function validateAccelerator(accelerator: string): string | null {
  const normalized = normalizeAccelerator(accelerator);
  const parts = normalized.split('+').filter(Boolean);
  if (parts.length < 2) {
    return 'Use at least one modifier key (Ctrl, Alt, Shift, Meta) plus a key.';
  }
  const hasModifier = parts.some((part) => ['Ctrl', 'Alt', 'Shift', 'Meta'].includes(part));
  if (!hasModifier) {
    return 'Use at least one modifier key (Ctrl, Alt, Shift, Meta) plus a key.';
  }
  return null;
}

export function getHotkeyAccelerator(id: DesktopHotkeyId): string {
  const bindings = readHotkeyBindings();
  const custom = bindings[id];
  if (custom) return normalizeAccelerator(custom);
  return getHotkeyDefinition(id).defaultAccelerator;
}

export function findHotkeyConflict(
  excludeId: DesktopHotkeyId,
  accelerator: string,
): DesktopHotkeyDefinition | null {
  const normalized = normalizeAccelerator(accelerator);
  for (const definition of DESKTOP_HOTKEY_DEFINITIONS) {
    if (definition.id === excludeId) continue;
    if (getHotkeyAccelerator(definition.id) === normalized) return definition;
  }
  return null;
}

export function writeHotkeyBinding(id: DesktopHotkeyId, accelerator: string): void {
  const normalized = normalizeAccelerator(accelerator);
  const validationError = validateAccelerator(normalized);
  if (validationError) throw new Error(validationError);

  const conflict = findHotkeyConflict(id, normalized);
  if (conflict) {
    throw new Error(`Already used by “${conflict.label}”.`);
  }

  const bindings = readHotkeyBindings();
  if (normalized === getHotkeyDefinition(id).defaultAccelerator) {
    delete bindings[id];
  } else {
    bindings[id] = normalized;
  }
  writeJson(HOTKEYS_STORAGE_KEY, bindings);
  notifyHotkeyListeners();
}

export function resetHotkeyBinding(id: DesktopHotkeyId): void {
  const bindings = readHotkeyBindings();
  delete bindings[id];
  writeJson(HOTKEYS_STORAGE_KEY, bindings);
  notifyHotkeyListeners();
}

export function resetAllHotkeyBindings(): void {
  writeJson(HOTKEYS_STORAGE_KEY, {});
  notifyHotkeyListeners();
}

export function keyboardEventToAccelerator(event: KeyboardEvent): string | null {
  if (event.repeat) return null;

  const ignoredKeys = new Set([
    'Control',
    'Shift',
    'Alt',
    'Meta',
    'CapsLock',
    'NumLock',
    'ScrollLock',
    'ContextMenu',
  ]);
  if (ignoredKeys.has(event.key)) return null;

  const parts: string[] = [];
  if (event.ctrlKey) parts.push('Ctrl');
  if (event.altKey) parts.push('Alt');
  if (event.shiftKey) parts.push('Shift');
  if (event.metaKey) parts.push('Meta');
  if (parts.length === 0) return null;

  let key = event.key;
  if (key === ' ') key = 'Space';
  else if (key === 'Escape') key = 'Escape';
  else if (key.startsWith('Arrow')) key = key.replace('Arrow', '');
  else if (key.length === 1) key = key.toUpperCase();
  else if (/^f\d{1,2}$/i.test(key)) key = key.toUpperCase();

  parts.push(key);
  return normalizeAccelerator(parts.join('+'));
}
