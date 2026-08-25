<script lang="ts">
  import { onMount } from 'svelte';
  import { createEditor } from '../lib/editor/monaco';
  import type { SessionTab } from '../lib/session';
  export let tab: SessionTab;
  export let fontSize = 14;
  export let onChange: (content: string) => void = () => {};
  let host: HTMLDivElement;
  onMount(() => {
    const editor = createEditor(host, fontSize);
    editor.setValue(tab.content);
    const subscription = editor.onDidChangeModelContent(() => onChange(editor.getValue()));
    editor.focus();
    return () => { subscription.dispose(); const model = editor.getModel(); editor.dispose(); model?.dispose(); };
  });
</script>
<div class="editor-surface" bind:this={host} aria-label="Edgedor editor"></div>
<style>.editor-surface { min-height: 0; flex: 1; overflow: hidden; }</style>
