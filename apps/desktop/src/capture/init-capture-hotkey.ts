import type { ConversationId } from '@/domain/shared/ids';
import { SCREENSHOT_ACTION_ID } from '@selectmind/shared';
import { rpcClient } from '@/infrastructure/messaging/rpc-client';
import { formatUnknownError } from './capture-utils';
import {
  buildScreenshotPageContext,
  runDesktopScreenCaptureFlow,
} from './run-desktop-capture-flow';

export { OCR_CAPTURE_HOTKEY_ID as OCR_HOTKEY_ID, getHotkeyAccelerator } from '../settings/desktop-hotkeys';

let captureInProgress = false;

export type CaptureConversationHandler = (conversationId: string) => void;
export type CaptureErrorHandler = (message: string) => void;
export type ResolveTargetConversation = () => ConversationId | null | undefined;

export interface RunDesktopScreenshotChatOptions {
  /** When set, append the screenshot to this chat instead of creating a new one. */
  targetConversationId?: ConversationId | null;
}

export async function runDesktopScreenshotChat(
  onConversation: CaptureConversationHandler,
  onError?: CaptureErrorHandler,
  options?: RunDesktopScreenshotChatOptions,
): Promise<void> {
  if (captureInProgress) return;
  captureInProgress = true;

  try {
    const screenshot = await runDesktopScreenCaptureFlow();
    if (!screenshot) return;

    const action = await rpcClient.call('action:get', { actionId: SCREENSHOT_ACTION_ID });
    if (!action) {
      throw new Error(`Screenshot action not found (${SCREENSHOT_ACTION_ID}). Try restarting the app.`);
    }

    const context = await buildScreenshotPageContext(screenshot);
    const targetConversationId = options?.targetConversationId ?? null;

    if (targetConversationId) {
      const result = await rpcClient.call('action:execute-in-conversation', {
        actionId: action.id,
        context,
        conversationId: targetConversationId,
      });
      onConversation(result.conversationId);
      return;
    }

    const result = await rpcClient.call('action:execute', { actionId: action.id, context });
    await rpcClient.call('conversation:promote', {
      conversationId: result.conversationId,
      mode: 'chat',
    });
    onConversation(result.conversationId);
  } catch (error) {
    const message = formatUnknownError(error, 'Capture failed');
    onError?.(message);
    throw error instanceof Error ? error : new Error(message);
  } finally {
    captureInProgress = false;
  }
}
