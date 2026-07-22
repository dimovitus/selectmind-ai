import { describe, it, expect } from 'vitest';
import { parseHotkey, matchesHotkey } from '@/shared/utils/hotkey';

describe('parseHotkey', () => {
  it('parses modifier keys', () => {
    const parsed = parseHotkey('Ctrl+Shift+E');
    expect(parsed).toEqual({
      ctrl: true,
      alt: false,
      shift: true,
      meta: false,
      key: 'e',
    });
  });
});

describe('matchesHotkey', () => {
  it('matches ctrl+shift+e', () => {
    const event = {
      key: 'e',
      code: 'KeyE',
      ctrlKey: true,
      shiftKey: true,
      altKey: false,
      metaKey: false,
    } as KeyboardEvent;
    expect(matchesHotkey(event, 'Ctrl+Shift+E')).toBe(true);
  });

  it('rejects wrong modifier', () => {
    const event = {
      key: 'e',
      code: 'KeyE',
      ctrlKey: false,
      shiftKey: true,
      altKey: false,
      metaKey: false,
    } as KeyboardEvent;
    expect(matchesHotkey(event, 'Ctrl+Shift+E')).toBe(false);
  });
});
