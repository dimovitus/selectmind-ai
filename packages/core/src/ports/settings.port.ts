import type { AppSettings } from '../types/settings';

/** Persisted user preferences (not conversation DB). */
export interface SettingsPort {
  get(): Promise<AppSettings>;
  update(partial: Partial<AppSettings>): Promise<AppSettings>;
}
