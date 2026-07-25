import type { Action } from '@/domain/action/action.schema';
import type { ActionId } from '@/domain/shared/ids';

export const FREE_CHAT_ACTION_ID = 'act_free_chat' as ActionId;

/** UI-only action descriptor for the toolbar free-chat button. */
export const FREE_CHAT_ACTION: Pick<Action, 'id' | 'name' | 'icon' | 'outputMode'> = {
  id: FREE_CHAT_ACTION_ID,
  name: 'Ask anything',
  icon: '✨',
  outputMode: 'chat',
};

export const FREE_CHAT_INPUT_PLACEHOLDER =
  'Ask anything — about the selection, page, or anything else…';
