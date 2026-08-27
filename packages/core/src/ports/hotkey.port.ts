export interface HotkeyRegistration {
  id: string;
  /** e.g. "Ctrl+Shift+X" */
  accelerator: string;
  description?: string;
}

export type HotkeyHandler = () => void;

/** Global shortcuts — chrome.commands on extension, OS-level on desktop. */
export interface HotkeyPort {
  register(registration: HotkeyRegistration, handler: HotkeyHandler): Promise<void>;
  unregister(id: string): Promise<void>;
}
