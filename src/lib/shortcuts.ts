export type ShortcutProfile = 'vscode' | 'sublime' | 'jetbrains' | 'vim';
export type EditorCommand = 'selectNextOccurrence' | 'selectAllOccurrences' | 'addCursorAbove' | 'addCursorBelow' | 'moveLineUp' | 'moveLineDown' | 'deleteLine' | 'toggleComment';

export const DEFAULT_SHORTCUT_PROFILE: ShortcutProfile = 'vscode';

export const shortcutProfiles: Record<ShortcutProfile, Partial<Record<EditorCommand, string>>> = {
  vscode: {
    selectNextOccurrence: 'Cmd+D', selectAllOccurrences: 'Cmd+Shift+L', addCursorAbove: 'Cmd+Alt+Up', addCursorBelow: 'Cmd+Alt+Down', moveLineUp: 'Alt+Up', moveLineDown: 'Alt+Down', deleteLine: 'Cmd+Shift+K', toggleComment: 'Cmd+/'
  },
  sublime: {
    selectNextOccurrence: 'Cmd+D', selectAllOccurrences: 'Cmd+Ctrl+G', addCursorAbove: 'Ctrl+Alt+Up', addCursorBelow: 'Ctrl+Alt+Down', moveLineUp: 'Ctrl+Cmd+Up', moveLineDown: 'Ctrl+Cmd+Down', deleteLine: 'Ctrl+Shift+K', toggleComment: 'Cmd+/'
  },
  jetbrains: {
    selectNextOccurrence: 'Ctrl+G', selectAllOccurrences: 'Ctrl+Alt+Shift+J', addCursorAbove: 'Alt+Shift+Up', addCursorBelow: 'Alt+Shift+Down', moveLineUp: 'Shift+Alt+Up', moveLineDown: 'Shift+Alt+Down', deleteLine: 'Cmd+Y', toggleComment: 'Cmd+/'
  },
  vim: {
    selectNextOccurrence: 'g*', selectAllOccurrences: ':%s', addCursorAbove: 'Ctrl+K', addCursorBelow: 'Ctrl+J', moveLineUp: 'ddP', moveLineDown: 'ddp', deleteLine: 'dd', toggleComment: 'gcc'
  }
};

export function resolveShortcut(profile: ShortcutProfile, command: EditorCommand, overrides: Record<string, string> = {}): string | undefined {
  return overrides[command] ?? shortcutProfiles[profile][command];
}

export function isShortcutCommand(command: string): command is EditorCommand {
  return Object.prototype.hasOwnProperty.call(shortcutProfiles.vscode, command);
}

export function shortcutOverridesFingerprint(overrides: Record<string, string>): string {
  return JSON.stringify(
    Object.entries(overrides)
      .filter(([command]) => isShortcutCommand(command))
      .sort(([first], [second]) => first.localeCompare(second))
  );
}

export function validateShortcut(binding: string): string | undefined {
  const value = binding.trim().replace(/\s+/g, '');
  if (!value || value.split('+').some((part) => !part)) return undefined;
  const parts = value.split('+').map((part) => part.toLowerCase());
  const modifiers = new Set(['cmd', 'command', 'meta', 'cmdorctrl', 'ctrl', 'control', 'alt', 'option', 'shift']);
  const key = parts.at(-1) ?? '';
  if (parts.slice(0, -1).some((part) => !modifiers.has(part))) return undefined;
  if (new Set(parts.slice(0, -1)).size !== parts.length - 1) return undefined;
  if (/^[a-z0-9]$/.test(key) || /^f([1-9]|1[0-9]|2[0-4])$/i.test(key)) return value;
  if (/^(tab|space|pageup|pagedown|home|end|insert|up|down|left|right|slash|semicolon|equal|comma|minus|period|backquote|bracketleft|backslash|bracketright|quote|backspace|delete|enter|escape|[;,=./`'\[\]\\-])$/i.test(key)) return value;
  return undefined;
}
