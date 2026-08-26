import * as monaco from 'monaco-editor';
import type { EditorCommand, ShortcutProfile } from '../shortcuts';
import { resolveShortcut, shortcutProfiles } from '../shortcuts';

const languageAliases: Record<string, string> = { js: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript', rs: 'rust', py: 'python', md: 'markdown', yml: 'yaml', sh: 'shell' };

export interface EditorVisibility {
  showLineNumbers: boolean;
  showMinimap: boolean;
  showFolding: boolean;
  showGlyphMargin: boolean;
}

export const DEFAULT_EDITOR_VISIBILITY: EditorVisibility = {
  showLineNumbers: true,
  showMinimap: true,
  showFolding: true,
  showGlyphMargin: false
};

export function createEditor(container: HTMLElement, fontSize = 14, language = 'plaintext', visibility: Partial<EditorVisibility> = {}): monaco.editor.IStandaloneCodeEditor {
  const model = monaco.editor.createModel('', languageAliases[language] ?? language);
  const options = { ...DEFAULT_EDITOR_VISIBILITY, ...visibility };
  return monaco.editor.create(container, { model, theme: matchMedia('(prefers-color-scheme: dark)').matches ? 'vs-dark' : 'vs', fontFamily: 'SF Mono, Menlo, monospace', fontSize, automaticLayout: true, lineNumbers: options.showLineNumbers ? 'on' : 'off', minimap: { enabled: options.showMinimap }, folding: options.showFolding, glyphMargin: options.showGlyphMargin, columnSelection: true, multiCursorModifier: 'alt', padding: { top: 18, bottom: 18 }, wordWrap: 'on' });
}

const commandIds: Record<EditorCommand, string> = {
  selectNextOccurrence: 'editor.action.addSelectionToNextFindMatch',
  selectAllOccurrences: 'editor.action.selectAllOccurrences',
  addCursorAbove: 'editor.action.insertCursorAbove',
  addCursorBelow: 'editor.action.insertCursorBelow',
  moveLineUp: 'editor.action.moveLinesUpAction',
  moveLineDown: 'editor.action.moveLinesDownAction',
  deleteLine: 'editor.action.removeLines',
  toggleComment: 'editor.action.commentLine'
};

export function parseKeybinding(binding: string): number | undefined {
  const parts = binding.split('+').map((part) => part.trim().toLowerCase());
  if (parts.length < 2 || parts.some((part) => !part)) return undefined;
  let value = 0;
  for (const part of parts.slice(0, -1)) {
    if (part === 'cmd' || part === 'command' || part === 'meta' || part === 'cmdorctrl') value |= monaco.KeyMod.CtrlCmd;
    else if (part === 'ctrl' || part === 'control') value |= monaco.KeyMod.WinCtrl;
    else if (part === 'alt' || part === 'option') value |= monaco.KeyMod.Alt;
    else if (part === 'shift') value |= monaco.KeyMod.Shift;
    else return undefined;
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
  return Object.prototype.hasOwnProperty.call(named, key) ? value | named[key] : undefined;
}

export function isValidShortcut(binding: string): boolean {
  return Boolean(parseKeybinding(binding));
}

function registerCommand(editor: monaco.editor.IStandaloneCodeEditor, command: EditorCommand, binding: string | undefined): void {
  const keybinding = binding ? parseKeybinding(binding) : undefined;
  if (keybinding) editor.addCommand(keybinding, () => void editor.getAction(commandIds[command])?.run());
}

export function applyShortcutProfile(editor: monaco.editor.IStandaloneCodeEditor, profile: ShortcutProfile, overrides: Record<string, string> = {}): void {
  for (const command of Object.keys(shortcutProfiles[profile])) {
    const editorCommand = command as EditorCommand;
    registerCommand(editor, editorCommand, resolveShortcut(profile, editorCommand, overrides));
  }
}

export function applyShortcutOverrides(editor: monaco.editor.IStandaloneCodeEditor, overrides: Record<string, string>): void {
  for (const [command, binding] of Object.entries(overrides)) {
    if (Object.prototype.hasOwnProperty.call(commandIds, command)) registerCommand(editor, command as EditorCommand, binding);
  }
}
