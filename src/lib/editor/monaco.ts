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
  let value = 0;
  for (const part of parts.slice(0, -1)) {
    if (part === 'cmd' || part === 'command') value |= monaco.KeyMod.CtrlCmd;
    if (part === 'ctrl' || part === 'control') value |= monaco.KeyMod.WinCtrl;
    if (part === 'alt' || part === 'option') value |= monaco.KeyMod.Alt;
    if (part === 'shift') value |= monaco.KeyMod.Shift;
  }
  const key = parts.at(-1) ?? '';
  if (key.length === 1 && /[a-z]/.test(key)) return value | (monaco.KeyCode.KeyA + key.charCodeAt(0) - 97);
  const named: Record<string, monaco.KeyCode> = {
    up: monaco.KeyCode.UpArrow,
    down: monaco.KeyCode.DownArrow,
    left: monaco.KeyCode.LeftArrow,
    right: monaco.KeyCode.RightArrow,
    slash: monaco.KeyCode.Slash,
    '/': monaco.KeyCode.Slash,
    backspace: monaco.KeyCode.Backspace,
    delete: monaco.KeyCode.Delete,
    enter: monaco.KeyCode.Enter,
    escape: monaco.KeyCode.Escape,
    k: monaco.KeyCode.KeyK,
    g: monaco.KeyCode.KeyG
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
