<script lang="ts">
  import { onMount } from 'svelte';
  import { createEditor } from '../lib/editor/monaco';
  let host: HTMLDivElement;
  onMount(() => { const editor = createEditor(host); editor.focus(); return () => { const model = editor.getModel(); editor.dispose(); model?.dispose(); }; });
</script>
<div class="editor-surface" bind:this={host} aria-label="Edgedor editor"></div>
<style>.editor-surface { min-height: 0; flex: 1; overflow: hidden; }</style>
