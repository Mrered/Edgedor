<script lang="ts">
  import { onMount } from 'svelte';
  import EditorSurface from '../components/EditorSurface.svelte';
  import ToolbarMount from '../components/ToolbarMount.svelte';
  import { listenPanelStatus, panelAction, type PanelStatus } from '../lib/tauri/panel';
  let status: PanelStatus = { visible: true, focused: true, bridgeReady: false };
  let unlisten: (() => void) | undefined;
  onMount(() => {
    void (async () => { unlisten = await listenPanelStatus((next) => (status = next)); await panelAction('show'); })();
    return () => unlisten?.();
  });
</script>
<svelte:head><title>Edgedor</title></svelte:head>
<main class="shell"><ToolbarMount /><section class="workspace" aria-label="临时编辑区"><EditorSurface /></section><footer aria-live="polite">{status.bridgeReady ? '原生面板已连接' : '正在连接原生面板…'}</footer></main>
<style>
  :global(*) { box-sizing: border-box; }
  :global(html, body) { margin: 0; min-width: 320px; height: 100%; }
  :global(body) { font-family: -apple-system, BlinkMacSystemFont, sans-serif; background: transparent; color: var(--text); }
  :global(:root) { color-scheme: light dark; --text: #1d1d1f; --muted: #6e6e73; --panel: rgba(255,255,255,.88); }
  @media (prefers-color-scheme: dark) { :global(:root) { --text: #f5f5f7; --muted: #a1a1a6; --panel: rgba(30,30,32,.92); } }
  .shell { height: 100vh; display: flex; flex-direction: column; overflow: hidden; background: var(--panel); }
  .workspace { min-height: 0; flex: 1; display: flex; }
  footer { padding: 6px 16px 10px; font-size: 11px; color: var(--muted); }
</style>
