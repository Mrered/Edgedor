<script lang="ts">
  import { onMount } from 'svelte';
  import { applyShortcutOverrides, applyShortcutProfile, createEditor, editorModelRegistry } from '../lib/editor/monaco';
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
  let editor: monaco.editor.IStandaloneCodeEditor | undefined;
  let model: monaco.editor.ITextModel | undefined;
  let vimMode: { dispose(): void } | undefined;
  let shortcutDisposable: monaco.IDisposable | undefined;
  let suppressSessionUpdate = false;

  function configureShortcuts(
    currentEditor: monaco.editor.IStandaloneCodeEditor,
    profile: typeof shortcutProfile,
    overrides: Record<string, string>,
    statusElement: HTMLDivElement
  ) {
    shortcutDisposable?.dispose();
    shortcutDisposable = undefined;
    vimMode?.dispose();
    vimMode = undefined;
    if (profile === 'vim') {
      vimMode = initVimMode(currentEditor, statusElement);
      shortcutDisposable = applyShortcutOverrides(currentEditor, overrides);
    } else {
      shortcutDisposable = applyShortcutProfile(currentEditor, profile, overrides);
    }
  }

  $: if (editor) {
    editor.updateOptions({
      fontSize,
      lineNumbers: (editorVisibility.showLineNumbers ?? true) ? 'on' : 'off',
      minimap: { enabled: editorVisibility.showMinimap ?? true },
      folding: editorVisibility.showFolding ?? true,
      glyphMargin: editorVisibility.showGlyphMargin ?? false
    });
  }
  $: if (model) editorModelRegistry.setLanguage(tab.id, tab.language);
  $: if (model && model.getValue() !== tab.content) {
    suppressSessionUpdate = true;
    try {
      editorModelRegistry.syncExternalContent(tab.id, tab.content);
    } finally {
      suppressSessionUpdate = false;
    }
  }
  $: if (editor && vimStatus) configureShortcuts(editor, shortcutProfile, shortcutOverrides, vimStatus);

  onMount(() => {
    const currentModel = editorModelRegistry.getOrCreate(tab.id, tab.content, tab.language);
    const currentEditor = createEditor(host, currentModel, fontSize, editorVisibility);
    model = currentModel;
    editor = currentEditor;
    if (tab.editor.viewState) {
      currentEditor.restoreViewState(tab.editor.viewState as monaco.editor.ICodeEditorViewState);
    }
    const subscription = currentEditor.onDidChangeModelContent(() => {
      if (!suppressSessionUpdate) onChange(currentEditor.getValue());
    });
    const saveState = () => {
      const viewState = currentEditor.saveViewState();
      if (viewState) onStateChange({ ...tab.editor, viewState });
    };
    const cursorSubscription = currentEditor.onDidChangeCursorPosition(saveState);
    const selectionSubscription = currentEditor.onDidChangeCursorSelection(saveState);
    const scrollSubscription = currentEditor.onDidScrollChange(saveState);
    currentEditor.focus();
    return () => {
      shortcutDisposable?.dispose();
      vimMode?.dispose();
      subscription.dispose();
      cursorSubscription.dispose();
      selectionSubscription.dispose();
      scrollSubscription.dispose();
      currentEditor.dispose();
      editor = undefined;
      model = undefined;
    };
  });
</script>
<div class="editor-wrap"><div class="editor-surface" bind:this={host} aria-label="Edgedor editor"></div><div class="vim-status" bind:this={vimStatus} aria-live="polite"></div></div>
<style>.editor-wrap { min-height: 0; flex: 1; display: flex; flex-direction: column; overflow: hidden; } .editor-surface { min-height: 0; flex: 1; overflow: hidden; } .vim-status:empty { display: none; } .vim-status { min-height: 18px; padding: 2px 8px; color: var(--muted, #888); font: 11px/14px ui-monospace, monospace; }</style>
