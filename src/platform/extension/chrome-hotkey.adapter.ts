import type { HotkeyHandler, HotkeyPort, HotkeyRegistration } from '@selectmind/core';

/**
 * Chrome extension: global shortcuts are declared in manifest `commands`.
 * Runtime registration is limited — this adapter is a stub until desktop hotkeys.
 */
export class ChromeHotkeyAdapter implements HotkeyPort {
  private handlers = new Map<string, HotkeyHandler>();

  async register(registration: HotkeyRegistration, handler: HotkeyHandler): Promise<void> {
    this.handlers.set(registration.id, handler);
  }

  async unregister(id: string): Promise<void> {
    this.handlers.delete(id);
  }

  /** Called from background lifecycle when a manifest command fires. */
  dispatch(id: string): void {
    this.handlers.get(id)?.();
  }
}
