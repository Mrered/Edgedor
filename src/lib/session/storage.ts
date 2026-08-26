import { serializeSession, serializeSettings, type SessionSettings, type SessionState } from './model.ts';

export const SESSION_KEY = 'edgedor.session';
export const SETTINGS_KEY = 'edgedor.settings';

export interface SessionStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function persistSessionSettings(storage: SessionStorage, settings: SessionSettings): void {
  storage.setItem(SETTINGS_KEY, serializeSettings(settings));
  if (!settings.preserveOnRestart) storage.removeItem(SESSION_KEY);
}

export function writeSessionCheckpoint(storage: SessionStorage, state: SessionState): void {
  if (state.settings.preserveOnRestart) {
    storage.setItem(SESSION_KEY, serializeSession(state));
    return;
  }
  storage.removeItem(SESSION_KEY);
}

export function clearSessionCheckpoint(storage: SessionStorage): void {
  storage.removeItem(SESSION_KEY);
}
