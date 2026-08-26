<script lang="ts">
  import { onMount } from 'svelte';
  import { applyShortcutProfile, createEditor } from '../lib/editor/monaco';
  import { initVimMode } from 'monaco-vim';
  import * as monaco from 'monaco-editor';
  import type { SessionTab } from '../lib/session';
  export let tab: SessionTab;
  export let fontSize = 14;
  export let shortcutProfile: 'vscode' | 'sublime' | 'jetbrains' | 'vim' = 'vscode';
  export let shortcutOverrides: Record<string, string> = {};
  export let editorVisibility: Partial<import('../lib/editor/monaco').EditorVisibility> = {};
  export let onChange: (content: string) => void = () => {};
  export let onStateChange: (state: SessionTab['editor']) => void = () => {};
  let host: HTMLDivElement;
  let vimStatus: HTMLDivElement;
  onMount(() => {
    const editor = createEditor(host, fontSize, tab.language, editorVisibility);
    const vimMode = shortcutProfile === 'vim' ? initVimMode(editor, vimStatus) : undefined;
    if (shortcutProfile !== 'vim') applyShortcutProfile(editor, shortcutProfile, shortcutOverrides);
    editor.setValue(tab.content);
    if (tab.editor.viewState) {
      editor.restoreViewState(tab.editor.viewState as monaco.editor.ICodeEditorViewState);
    }
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyP, () => { void editor.getAction('editor.action.quickCommand')?.run(); });
    const subscription = editor.onDidChangeModelContent(() => onChange(editor.getValue()));
    const saveState = () => {
      const viewState = editor.saveViewState();
      if (viewState) onStateChange({ ...tab.editor, viewState });
    };
    const cursorSubscription = editor.onDidChangeCursorPosition(saveState);
    const selectionSubscription = editor.onDidChangeCursorSelection(saveState);
    const scrollSubscription = editor.onDidScrollChange(saveState);
    editor.focus();
    return () => { vimMode?.dispose(); subscription.dispose(); cursorSubscription.dispose(); selectionSubscription.dispose(); scrollSubscription.dispose(); const model = editor.getModel(); editor.dispose(); model?.dispose(); };
  });
</script>
<div class="editor-wrap"><div class="editor-surface" bind:this={host} aria-label="Edgedor editor"></div><div class="vim-status" bind:this={vimStatus} aria-live="polite"></div></div>
<style>.editor-wrap { min-height: 0; flex: 1; display: flex; flex-direction: column; overflow: hidden; } .editor-surface { min-height: 0; flex: 1; overflow: hidden; } .vim-status:empty { display: none; } .vim-status { min-height: 18px; padding: 2px 8px; color: var(--muted, #888); font: 11px/14px ui-monospace, monospace; }</style>
