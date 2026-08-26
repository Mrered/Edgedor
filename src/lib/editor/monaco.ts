import * as monaco from 'monaco-editor';
import type { EditorCommand, ShortcutModifier, ShortcutProfile } from '../shortcuts';
import { parseShortcut, resolveShortcut, SHORTCUT_KEY_CODE_NAMES, shortcutProfiles } from '../shortcuts';
import { TabModelRegistry } from './modelRegistry';

const languageAliases: Record<string, string> = { js: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript', rs: 'rust', py: 'python', md: 'markdown', yml: 'yaml', sh: 'shell' };

export function normalizeEditorLanguage(language: string): string {
  return languageAliases[language] ?? language;
}

export function createMonacoModelRegistry(): TabModelRegistry<monaco.editor.ITextModel> {
  return new TabModelRegistry({
    createModel: (content, language) => monaco.editor.createModel(content, language),
    getValue: (model) => model.getValue(),
    setLanguage: (model, language) => monaco.editor.setModelLanguage(model, language),
    replaceAll(model, content) {
      model.pushStackElement();
      model.pushEditOperations(null, [{ range: model.getFullModelRange(), text: content }], () => null);
      model.pushStackElement();
    },
    disposeModel: (model) => model.dispose()
  }, normalizeEditorLanguage);
}

export const editorModelRegistry = createMonacoModelRegistry();

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

export function createEditor(container: HTMLElement, model: monaco.editor.ITextModel, fontSize = 14, visibility: Partial<EditorVisibility> = {}): monaco.editor.IStandaloneCodeEditor {
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
let shortcutRegistrationSequence = 0;

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

function registerCommand(editor: monaco.editor.IStandaloneCodeEditor, command: EditorCommand, binding: string | undefined): monaco.IDisposable | undefined {
  const keybinding = binding ? parseKeybinding(binding) : undefined;
  if (!keybinding) return undefined;
  shortcutRegistrationSequence += 1;
  return editor.addAction({
    id: `edgedor.shortcut.${command}.${shortcutRegistrationSequence}`,
    label: `Edgedor: ${command}`,
    keybindings: [keybinding],
    run: () => void editor.getAction(commandIds[command])?.run()
  });
}

function combineDisposables(disposables: Array<monaco.IDisposable | undefined>): monaco.IDisposable {
  return { dispose: () => { for (const disposable of disposables) disposable?.dispose(); } };
}

export function applyShortcutProfile(editor: monaco.editor.IStandaloneCodeEditor, profile: ShortcutProfile, overrides: Record<string, string> = {}): monaco.IDisposable {
  const disposables: Array<monaco.IDisposable | undefined> = [];
  for (const command of Object.keys(shortcutProfiles[profile])) {
    const editorCommand = command as EditorCommand;
    disposables.push(registerCommand(editor, editorCommand, resolveShortcut(profile, editorCommand, overrides)));
  }
  return combineDisposables(disposables);
}

export function applyShortcutOverrides(editor: monaco.editor.IStandaloneCodeEditor, overrides: Record<string, string>): monaco.IDisposable {
  const disposables: Array<monaco.IDisposable | undefined> = [];
  for (const [command, binding] of Object.entries(overrides)) {
    if (Object.prototype.hasOwnProperty.call(commandIds, command)) disposables.push(registerCommand(editor, command as EditorCommand, binding));
  }
  return combineDisposables(disposables);
}
