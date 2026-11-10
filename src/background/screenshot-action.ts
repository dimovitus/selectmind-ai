import type { Action } from '@/domain/action/action.schema';
import type { ActionId } from '@/domain/shared/ids';
import { SCREENSHOT_ACTION_ID } from '@/shared/constants/screenshot-action';

/**
 * Resolve the action used by the OCR / screen-capture button.
 *
 * Prefer the action configured in Settings. If it was deleted or disabled,
 * fall back to the built-in screenshot action, then to the first enabled action.
 */
export function pickScreenshotAction(
  actions: readonly Action[],
  configuredId: ActionId | null | undefined,
): Action | null {
  const enabled = actions.filter((action) => action.isEnabled);

  if (configuredId) {
    const configured = enabled.find((action) => action.id === configuredId);
    if (configured) return configured;
  }

  const builtIn = enabled.find((action) => action.id === SCREENSHOT_ACTION_ID);
  if (builtIn) return builtIn;

  return [...enabled].sort((a, b) => a.order - b.order)[0] ?? null;
}
