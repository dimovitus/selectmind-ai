import type { Action } from '@/domain/action/action.schema';
import type { ActionId } from '@/domain/shared/ids';

export const SCREENSHOT_ACTION_ID = 'act_explain_screenshot' as ActionId;

/** UI-only descriptor for the toolbar screenshot button. */
export const SCREENSHOT_CAPTURE_ACTION: Pick<Action, 'id' | 'name' | 'icon' | 'outputMode'> = {
  id: SCREENSHOT_ACTION_ID,
  name: 'Explain screenshot',
  icon: '📸',
  outputMode: 'chat',
};
