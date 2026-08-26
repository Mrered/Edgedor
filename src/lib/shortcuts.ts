export type ShortcutProfile = 'vscode' | 'sublime' | 'jetbrains' | 'vim';
export type EditorCommand = 'selectNextOccurrence' | 'selectAllOccurrences' | 'addCursorAbove' | 'addCursorBelow' | 'moveLineUp' | 'moveLineDown' | 'deleteLine' | 'toggleComment';
export type ShortcutModifier = 'Cmd' | 'Ctrl' | 'Alt' | 'Shift';

const LETTER_KEYS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'] as const;
const DIGIT_KEYS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;
const FUNCTION_KEYS = ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12', 'F13', 'F14', 'F15', 'F16', 'F17', 'F18', 'F19', 'F20', 'F21', 'F22', 'F23', 'F24'] as const;
const NAMED_KEYS = ['Tab', 'Space', 'PageUp', 'PageDown', 'Home', 'End', 'Insert', 'Up', 'Down', 'Left', 'Right', 'Slash', 'Semicolon', 'Equal', 'Comma', 'Minus', 'Period', 'Backquote', 'BracketLeft', 'Backslash', 'BracketRight', 'Quote', 'Backspace', 'Delete', 'Enter', 'Escape'] as const;

export const SHORTCUT_KEYS = [...LETTER_KEYS, ...DIGIT_KEYS, ...FUNCTION_KEYS, ...NAMED_KEYS] as const;
export type ShortcutKey = typeof SHORTCUT_KEYS[number];

type LetterKey = typeof LETTER_KEYS[number];
type DigitKey = typeof DIGIT_KEYS[number];
type FunctionKey = typeof FUNCTION_KEYS[number];
type NamedKey = typeof NAMED_KEYS[number];

const LETTER_KEY_CODE_NAMES = Object.fromEntries(LETTER_KEYS.map((key) => [key, `Key${key}`])) as Record<LetterKey, string>;
const DIGIT_KEY_CODE_NAMES = Object.fromEntries(DIGIT_KEYS.map((key) => [key, `Digit${key}`])) as Record<DigitKey, string>;
const FUNCTION_KEY_CODE_NAMES = Object.fromEntries(FUNCTION_KEYS.map((key) => [key, key])) as Record<FunctionKey, string>;
const NAMED_KEY_CODE_NAMES = {
  Tab: 'Tab', Space: 'Space', PageUp: 'PageUp', PageDown: 'PageDown', Home: 'Home', End: 'End', Insert: 'Insert',
  Up: 'UpArrow', Down: 'DownArrow', Left: 'LeftArrow', Right: 'RightArrow', Slash: 'Slash', Semicolon: 'Semicolon',
  Equal: 'Equal', Comma: 'Comma', Minus: 'Minus', Period: 'Period', Backquote: 'Backquote', BracketLeft: 'BracketLeft',
  Backslash: 'Backslash', BracketRight: 'BracketRight', Quote: 'Quote', Backspace: 'Backspace', Delete: 'Delete', Enter: 'Enter', Escape: 'Escape'
} satisfies Record<NamedKey, string>;

export const SHORTCUT_KEY_CODE_NAMES = {
  ...LETTER_KEY_CODE_NAMES,
  ...DIGIT_KEY_CODE_NAMES,
  ...FUNCTION_KEY_CODE_NAMES,
  ...NAMED_KEY_CODE_NAMES
} satisfies Record<ShortcutKey, string>;

export interface ParsedShortcut {
  modifiers: readonly ShortcutModifier[];
  key: ShortcutKey;
  normalized: string;
}

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

const MODIFIER_ALIASES: Record<string, ShortcutModifier> = {
  cmd: 'Cmd', command: 'Cmd', meta: 'Cmd', cmdorctrl: 'Cmd',
  ctrl: 'Ctrl', control: 'Ctrl', alt: 'Alt', option: 'Alt', shift: 'Shift'
};
const MODIFIER_ORDER: readonly ShortcutModifier[] = ['Cmd', 'Ctrl', 'Alt', 'Shift'];
const KEY_ALIASES: Record<string, ShortcutKey> = Object.fromEntries(SHORTCUT_KEYS.map((key) => [key.toLowerCase(), key])) as Record<string, ShortcutKey>;
Object.assign(KEY_ALIASES, {
  '/': 'Slash', ';': 'Semicolon', '=': 'Equal', ',': 'Comma', '-': 'Minus', '.': 'Period',
  '`': 'Backquote', '[': 'BracketLeft', '\\': 'Backslash', ']': 'BracketRight', "'": 'Quote'
} satisfies Record<string, ShortcutKey>);

export function parseShortcut(binding: string): ParsedShortcut | undefined {
  const parts = binding.trim().replace(/\s+/g, '').split('+');
  if (parts.length < 2 || parts.some((part) => part.length === 0)) return undefined;
  const key = KEY_ALIASES[parts.at(-1)?.toLowerCase() ?? ''];
  if (!key) return undefined;
  const modifiers = new Set<ShortcutModifier>();
  for (const part of parts.slice(0, -1)) {
    const modifier = MODIFIER_ALIASES[part.toLowerCase()];
    if (!modifier || modifiers.has(modifier)) return undefined;
    modifiers.add(modifier);
  }
  if (modifiers.size === 0) return undefined;
  const orderedModifiers = MODIFIER_ORDER.filter((modifier) => modifiers.has(modifier));
  return { modifiers: orderedModifiers, key, normalized: [...orderedModifiers, key].join('+') };
}

export function validateShortcut(binding: string): string | undefined {
  return parseShortcut(binding)?.normalized;
}
