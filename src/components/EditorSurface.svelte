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
  let host: HTMLDivElement;
  onMount(() => {
    const editor = createEditor(host, fontSize, tab.language);
    applyShortcutProfile(editor, shortcutProfile, shortcutOverrides);
    editor.setValue(tab.content);
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyP, () => { void editor.getAction('editor.action.quickCommand')?.run(); });
    const subscription = editor.onDidChangeModelContent(() => onChange(editor.getValue()));
    editor.focus();
    return () => { subscription.dispose(); const model = editor.getModel(); editor.dispose(); model?.dispose(); };
  });
</script>
<div class="editor-surface" bind:this={host} aria-label="Edgedor editor"></div>
<style>.editor-surface { min-height: 0; flex: 1; overflow: hidden; }</style>
