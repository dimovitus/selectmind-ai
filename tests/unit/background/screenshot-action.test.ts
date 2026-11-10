import { describe, expect, it } from 'vitest';
import type { Action } from '@/domain/action/action.schema';
import type { ActionId } from '@/domain/shared/ids';
import { pickScreenshotAction } from '@/background/screenshot-action';
import { SCREENSHOT_ACTION_ID } from '@/shared/constants/screenshot-action';

function makeAction(
  id: string,
  options: { enabled?: boolean; order?: number } = {},
): Action {
  const timestamp = 1;
  return {
    id: id as ActionId,
    name: id,
    icon: '⚡',
    categoryId: 'cat_test' as Action['categoryId'],
    prompt: '{{selection}}',
    temperature: 0.7,
    streaming: true,
    outputMode: 'popup',
    isBuiltIn: id === SCREENSHOT_ACTION_ID,
    isEnabled: options.enabled ?? true,
    order: options.order ?? 0,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

describe('pickScreenshotAction', () => {
  it('uses the configured action when it is enabled', () => {
    const configured = makeAction('act_custom', { order: 50 });
    const actions = [makeAction(SCREENSHOT_ACTION_ID), configured];

    expect(pickScreenshotAction(actions, configured.id)?.id).toBe(configured.id);
  });

  it('falls back to the built-in screenshot action when the configured action is disabled', () => {
    const configured = makeAction('act_custom', { enabled: false });
    const actions = [makeAction(SCREENSHOT_ACTION_ID), configured];

    expect(pickScreenshotAction(actions, configured.id)?.id).toBe(SCREENSHOT_ACTION_ID);
  });

  it('falls back to the built-in screenshot action when the configured id is unknown', () => {
    const actions = [makeAction(SCREENSHOT_ACTION_ID), makeAction('act_custom')];

    expect(pickScreenshotAction(actions, 'act_missing' as ActionId)?.id).toBe(
      SCREENSHOT_ACTION_ID,
    );
  });

  it('uses the first enabled action when the built-in action is disabled', () => {
    const actions = [
      makeAction(SCREENSHOT_ACTION_ID, { enabled: false }),
      makeAction('act_second', { order: 20 }),
      makeAction('act_first', { order: 10 }),
    ];

    expect(pickScreenshotAction(actions, null)?.id).toBe('act_first');
  });

  it('returns null when no action is enabled', () => {
    const actions = [makeAction(SCREENSHOT_ACTION_ID, { enabled: false })];

    expect(pickScreenshotAction(actions, SCREENSHOT_ACTION_ID)).toBeNull();
  });
});
