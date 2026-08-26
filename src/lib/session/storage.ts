import {
  DEFAULT_SESSION_SETTINGS,
  deserializeSession,
  deserializeSettings,
  serializeSession,
  serializeSettings,
  type SessionSettings,
  type SessionState
} from './model.ts';

export const SESSION_KEY = 'edgedor.session';
export const SETTINGS_KEY = 'edgedor.settings';

export interface SessionStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface StartupState {
  settings: SessionSettings;
  session?: SessionState;
}

export type CheckpointResult = { ok: true } | { ok: false; error: unknown };

function defaultSettings(): SessionSettings {
  return { ...DEFAULT_SESSION_SETTINGS, shortcutOverrides: {} };
}

export function readStartupState(storage: SessionStorage): StartupState {
  const storedSettings = deserializeSettings(storage.getItem(SETTINGS_KEY) ?? '');
  if (storedSettings && !storedSettings.preserveOnRestart) {
    clearSessionCheckpoint(storage);
    return { settings: storedSettings };
  }

  const serializedSession = storage.getItem(SESSION_KEY);
  const restoredSession = serializedSession === null ? undefined : deserializeSession(serializedSession);
  if (serializedSession !== null && !restoredSession) clearSessionCheckpoint(storage);

  const settings = storedSettings
    ?? (restoredSession ? { ...restoredSession.settings, preserveOnRestart: true } : defaultSettings());
  return {
    settings,
    session: restoredSession ? { ...restoredSession, settings } : undefined
  };
}

export function persistSessionSettings(storage: SessionStorage, settings: SessionSettings): void {
  storage.setItem(SETTINGS_KEY, serializeSettings(settings));
  if (!settings.preserveOnRestart) storage.removeItem(SESSION_KEY);
}

export function writeSessionCheckpoint(storage: SessionStorage, state: SessionState): CheckpointResult {
  try {
    if (state.settings.preserveOnRestart) {
      storage.setItem(SESSION_KEY, serializeSession(state));
    } else {
      storage.removeItem(SESSION_KEY);
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, error };
  }
}

export function clearSessionCheckpoint(storage: SessionStorage): void {
  storage.removeItem(SESSION_KEY);
}
