import type { HotkeyHandler, HotkeyPort, HotkeyRegistration } from '@selectmind/core';

type RegistrationEntry = {
  registration: HotkeyRegistration;
  handler: HotkeyHandler;
  tauriShortcut: string;
};

const registrations = new Map<string, RegistrationEntry>();

function toTauriAccelerator(accelerator: string): string {
  return accelerator
    .split('+')
    .map((part) => {
      const token = part.trim();
      if (/^ctrl$/i.test(token) || /^control$/i.test(token)) return 'Control';
      if (/^cmd$/i.test(token) || /^command$/i.test(token)) return 'CommandOrControl';
      if (/^alt$/i.test(token)) return 'Alt';
      if (/^shift$/i.test(token)) return 'Shift';
      if (/^meta$/i.test(token)) return 'Super';
      if (token.length === 1) return token.toUpperCase();
      return token;
    })
    .join('+')
    .replace(/^Control\+/, 'CommandOrControl+')
    .replace(/\+Control\+/g, '+CommandOrControl+');
}

async function registerWithPlugin(
  shortcut: string,
  handler: HotkeyHandler,
): Promise<boolean> {
  try {
    const { register } = await import('@tauri-apps/plugin-global-shortcut');
    await register(shortcut, (event) => {
      if (event.state === 'Pressed') {
        handler();
      }
    });
    return true;
  } catch {
    return false;
  }
}

async function unregisterFromPlugin(shortcut: string): Promise<void> {
  try {
    const { unregister } = await import('@tauri-apps/plugin-global-shortcut');
    await unregister(shortcut);
  } catch {
    /* not in Tauri runtime */
  }
}

/** Desktop: Tauri global shortcut plugin with in-memory fallback for tests. */
export class TauriHotkeyAdapter implements HotkeyPort {
  async register(registration: HotkeyRegistration, handler: HotkeyHandler): Promise<void> {
    const existing = registrations.get(registration.id);
    if (existing) {
      await this.unregister(registration.id);
    }

    const tauriShortcut = toTauriAccelerator(registration.accelerator);
    const registered = await registerWithPlugin(tauriShortcut, handler);
    registrations.set(registration.id, {
      registration,
      handler,
      tauriShortcut: registered ? tauriShortcut : '',
    });
  }

  async unregister(id: string): Promise<void> {
    const entry = registrations.get(id);
    if (!entry) return;
    if (entry.tauriShortcut) {
      await unregisterFromPlugin(entry.tauriShortcut);
    }
    registrations.delete(id);
  }

  /** Test helper — invoke a registered handler by id. */
  trigger(id: string): void {
    registrations.get(id)?.handler();
  }

  listRegistrations(): HotkeyRegistration[] {
    return [...registrations.values()].map((entry) => entry.registration);
  }
}
