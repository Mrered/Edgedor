<script lang="ts">
  import { onMount } from 'svelte';
  import { applyShortcutProfile, createEditor } from '../lib/editor/monaco';
  import * as monaco from 'monaco-editor';
  import type { SessionTab } from '../lib/session';
  export let tab: SessionTab;
  export let fontSize = 14;
  export let shortcutProfile: 'vscode' | 'sublime' | 'jetbrains' | 'vim' = 'vscode';
  export let shortcutOverrides: Record<string, string> = {};
  export let onChange: (content: string) => void = () => {};
  export let onStateChange: (state: SessionTab['editor']) => void = () => {};
  let host: HTMLDivElement;
  onMount(() => {
    const editor = createEditor(host, fontSize, tab.language);
    applyShortcutProfile(editor, shortcutProfile, shortcutOverrides);
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
    const scrollSubscription = editor.onDidScrollChange(saveState);
    editor.focus();
    return () => { subscription.dispose(); cursorSubscription.dispose(); scrollSubscription.dispose(); const model = editor.getModel(); editor.dispose(); model?.dispose(); };
  });
</script>
<div class="editor-surface" bind:this={host} aria-label="Edgedor editor"></div>
<style>.editor-surface { min-height: 0; flex: 1; overflow: hidden; }</style>
