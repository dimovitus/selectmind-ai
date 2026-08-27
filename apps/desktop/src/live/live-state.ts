import { emit } from '@tauri-apps/api/event';
import type { LiveStateChangedPayload } from './types';

export async function emitLiveStateChanged(active: boolean): Promise<void> {
  const payload: LiveStateChangedPayload = { active };
  await emit('live:state-changed', payload);
}
