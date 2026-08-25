import * as monaco from 'monaco-editor';
import type { ShortcutProfile } from '../shortcuts';
import { resolveShortcut, shortcutProfiles } from '../shortcuts';

const languageAliases: Record<string, string> = { js: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript', rs: 'rust', py: 'python', md: 'markdown', yml: 'yaml', sh: 'shell' };

export function createEditor(container: HTMLElement, fontSize = 14, language = 'plaintext'): monaco.editor.IStandaloneCodeEditor {
  const model = monaco.editor.createModel('', languageAliases[language] ?? language);
  return monaco.editor.create(container, { model, theme: matchMedia('(prefers-color-scheme: dark)').matches ? 'vs-dark' : 'vs', fontFamily: 'SF Mono, Menlo, monospace', fontSize, automaticLayout: true, minimap: { enabled: true }, padding: { top: 18, bottom: 18 }, wordWrap: 'on' });
}

const commandIds: Record<string, string> = {
  selectNextOccurrence: 'editor.action.addSelectionToNextFindMatch',
  selectAllOccurrences: 'editor.action.selectHighlights',
  addCursorAbove: 'editor.action.insertCursorAbove',
  addCursorBelow: 'editor.action.insertCursorBelow',
  moveLineUp: 'editor.action.moveLinesUpAction',
  moveLineDown: 'editor.action.moveLinesDownAction',
  deleteLine: 'editor.action.removeLines',
  toggleComment: 'editor.action.commentLine'
};

function parseKeybinding(binding: string): number | undefined {
  const parts = binding.split('+').map((part) => part.trim().toLowerCase());
  if (parts.length === 0 || parts.some((part) => !part)) return undefined;
  let value = 0;
  for (const part of parts.slice(0, -1)) {
    if (part === 'cmd' || part === 'command' || part === 'meta') value |= monaco.KeyMod.CtrlCmd;
    if (part === 'ctrl' || part === 'control' || part === 'cmdorctrl') value |= monaco.KeyMod.WinCtrl;
    if (part === 'alt' || part === 'option') value |= monaco.KeyMod.Alt;
    if (part === 'shift') value |= monaco.KeyMod.Shift;
  }
  const key = parts.at(-1) ?? '';
  if (key.length === 1 && /[a-z]/.test(key)) return value | (monaco.KeyCode.KeyA + key.charCodeAt(0) - 97);
  if (key.length === 1 && /[0-9]/.test(key)) return value | (monaco.KeyCode.Digit0 + Number(key));
  if (/^f([1-9]|1[0-9]|2[0-4])$/.test(key)) return value | (monaco.KeyCode.F1 + Number(key.slice(1)) - 1);
  const named: Record<string, monaco.KeyCode> = {
    tab: monaco.KeyCode.Tab,
    space: monaco.KeyCode.Space,
    pageup: monaco.KeyCode.PageUp,
    pagedown: monaco.KeyCode.PageDown,
    home: monaco.KeyCode.Home,
    end: monaco.KeyCode.End,
    insert: monaco.KeyCode.Insert,
    up: monaco.KeyCode.UpArrow,
    down: monaco.KeyCode.DownArrow,
    left: monaco.KeyCode.LeftArrow,
    right: monaco.KeyCode.RightArrow,
    slash: monaco.KeyCode.Slash,
    '/': monaco.KeyCode.Slash,
    semicolon: monaco.KeyCode.Semicolon,
    ';': monaco.KeyCode.Semicolon,
    equal: monaco.KeyCode.Equal,
    '=': monaco.KeyCode.Equal,
    comma: monaco.KeyCode.Comma,
    ',': monaco.KeyCode.Comma,
    minus: monaco.KeyCode.Minus,
    '-': monaco.KeyCode.Minus,
    period: monaco.KeyCode.Period,
    '.': monaco.KeyCode.Period,
    backquote: monaco.KeyCode.Backquote,
    '`': monaco.KeyCode.Backquote,
    bracketleft: monaco.KeyCode.BracketLeft,
    '[': monaco.KeyCode.BracketLeft,
    backslash: monaco.KeyCode.Backslash,
    '\\': monaco.KeyCode.Backslash,
    bracketright: monaco.KeyCode.BracketRight,
    ']': monaco.KeyCode.BracketRight,
    quote: monaco.KeyCode.Quote,
    "'": monaco.KeyCode.Quote,
    backspace: monaco.KeyCode.Backspace,
    delete: monaco.KeyCode.Delete,
    enter: monaco.KeyCode.Enter,
    escape: monaco.KeyCode.Escape
  };
  return named[key] ? value | named[key] : undefined;
}

export function applyShortcutProfile(editor: monaco.editor.IStandaloneCodeEditor, profile: ShortcutProfile, overrides: Record<string, string> = {}): void {
  for (const command of Object.keys(shortcutProfiles[profile])) {
    const binding = resolveShortcut(profile, command as import('../shortcuts').EditorCommand, overrides);
    const keybinding = binding ? parseKeybinding(binding) : undefined;
    const commandId = commandIds[command];
    if (keybinding && commandId) editor.addCommand(keybinding, () => void editor.getAction(commandId)?.run());
  }
}
