import * as monaco from 'monaco-editor';
import type { EditorCommand, ShortcutModifier, ShortcutProfile } from '../shortcuts';
import { parseShortcut, resolveShortcut, SHORTCUT_KEY_CODE_NAMES, shortcutProfiles } from '../shortcuts';

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
  const parsed = parseShortcut(binding);
  if (!parsed) return undefined;
  const modifierMasks = {
    Cmd: monaco.KeyMod.CtrlCmd,
    Ctrl: monaco.KeyMod.WinCtrl,
    Alt: monaco.KeyMod.Alt,
    Shift: monaco.KeyMod.Shift
  } satisfies Record<ShortcutModifier, number>;
  const keyCode = monaco.KeyCode[SHORTCUT_KEY_CODE_NAMES[parsed.key] as keyof typeof monaco.KeyCode];
  if (typeof keyCode !== 'number') return undefined;
  return parsed.modifiers.reduce((value, modifier) => value | modifierMasks[modifier], keyCode);
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
