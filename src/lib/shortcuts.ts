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
