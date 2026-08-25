<script lang="ts">
  import { onMount } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { open, save } from '@tauri-apps/plugin-dialog';
  import EditorSurface from '../components/EditorSurface.svelte';
  import PreviewSurface from '../components/PreviewSurface.svelte';
  import ToolbarMount from '../components/ToolbarMount.svelte';
  import { listenPanelStatus, panelAction, type PanelStatus } from '../lib/tauri/panel';
  import { addTab, closeTab, createSessionState, createTab, deserializeSession, expireTabs, focusTab, restoreLatest, serializeSession, updateTab, type SessionState, type SessionTab } from '../lib/session';
  let status: PanelStatus = { visible: true, focused: true, bridgeReady: false };
  let pinned = false;
  let session: SessionState = createSessionState();
  let activeTab: SessionTab | undefined;
  let unlisten: (() => void) | undefined;
  let expiryTimer: number | undefined;
  $: activeTab = session.tabs.find((tab) => tab.id === session.groups.find((group) => group.id === session.activeGroupId)?.activeTabId);
  function persist(next: SessionState) { session = next; if (session.settings.preserveOnRestart) localStorage.setItem('edgedor.session', serializeSession(session)); }
  function newTab() { persist(addTab(session, createTab())); }
  function closeActive() { if (activeTab) persist(closeTab(session, activeTab.id)); }
  function restoreClosed() { persist(restoreLatest(session)); }
  function editContent(content: string) { if (activeTab) persist(updateTab(session, activeTab.id, { content })); }
  async function saveActive() {
    if (!activeTab) return;
    const path = activeTab.filePath ?? await save({ defaultPath: `${activeTab.title.replace(/[^\w.-]+/g, '-')}.txt`, filters: [{ name: '文本文件', extensions: ['txt', 'md', 'json', 'js', 'ts', 'rs', 'py'] }] });
    if (!path) return;
    try { await invoke('save_file', { path, content: activeTab.content, encoding: activeTab.encoding ?? 'utf-8', lineEnding: activeTab.lineEnding ?? '\n' }); persist(updateTab(session, activeTab.id, { filePath: path, kind: 'file' })); }
    catch (error) { window.alert(`保存失败：${String(error)}`); }
  }
  async function togglePinned() { pinned = !pinned; await invoke('set_panel_pinned', { pinned }); }
  function setShortcutProfile(event: Event) { const value = (event.currentTarget as HTMLSelectElement).value as SessionState['settings']['shortcutProfile']; persist({ ...session, settings: { ...session.settings, shortcutProfile: value } }); }
  function setPreserveOnRestart(event: Event) { const preserve = (event.currentTarget as HTMLInputElement).checked; const next = { ...session, settings: { ...session.settings, preserveOnRestart: preserve } }; session = next; if (preserve) localStorage.setItem('edgedor.session', serializeSession(next)); else localStorage.removeItem('edgedor.session'); }
  function changeFontSize(delta: number) { persist({ ...session, settings: { ...session.settings, fontSize: Math.max(10, Math.min(32, session.settings.fontSize + delta)) } }); }
  async function openTextFile() {
    const path = await open({ multiple: false, directory: false });
    if (!path) return;
    const selectedPath = Array.isArray(path) ? path[0] : path;
    if (!selectedPath) return;
    try { const opened = await invoke<{ path: string; content: string; language: string; encoding: string; line_ending: '\n' | '\r\n' | '\r' }>('open_text_file', { path: selectedPath }); persist(addTab(session, createTab({ kind: 'file', filePath: opened.path, content: opened.content, language: opened.language, encoding: opened.encoding, lineEnding: opened.line_ending, title: selectedPath.split('/').at(-1) }))); }
    catch (error) { window.alert(String(error)); }
  }
  async function openPreviewFile() {
    const path = await open({ multiple: false, directory: false });
    const selectedPath = Array.isArray(path) ? path[0] : path;
    if (!selectedPath) return;
    try { const preview = await invoke<{ path: string; data_url: string; mime: string }>('preview_file', { path: selectedPath }); persist(addTab(session, createTab({ kind: 'preview', filePath: preview.path, content: preview.data_url, language: 'preview', title: selectedPath.split('/').at(-1), readOnly: true, previewDataUrl: preview.data_url, previewMime: preview.mime }))); }
    catch (error) { window.alert(String(error)); }
  }
  async function openDroppedFile(event: DragEvent) {
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0] as (File & { path?: string }) | undefined;
    if (file?.path) {
      try { const opened = await invoke<{ path: string; content: string; language: string; encoding: string; line_ending: '\n' | '\r\n' | '\r' }>('open_text_file', { path: file.path }); persist(addTab(session, createTab({ kind: 'file', filePath: opened.path, content: opened.content, language: opened.language, encoding: opened.encoding, lineEnding: opened.line_ending, title: file.name }))); }
      catch (error) { window.alert(String(error)); }
    }
  }
  onMount(() => {
    const saved = deserializeSession(localStorage.getItem('edgedor.session') ?? '');
    session = saved ?? addTab(session, createTab());
    expiryTimer = window.setInterval(() => { const result = expireTabs(session); if (result.expired.length) persist(result.state); }, 60_000);
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') { event.preventDefault(); void saveActive(); }
      if ((event.metaKey || event.ctrlKey) && (event.key === '+' || event.key === '=')) { event.preventDefault(); changeFontSize(1); }
      if ((event.metaKey || event.ctrlKey) && event.key === '-') { event.preventDefault(); changeFontSize(-1); }
      if ((event.metaKey || event.ctrlKey) && event.key === '0') { event.preventDefault(); persist({ ...session, settings: { ...session.settings, fontSize: 14 } }); }
    };
    window.addEventListener('keydown', onKeyDown);
    const onDragOver = (event: DragEvent) => event.preventDefault();
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('drop', openDroppedFile);
    void (async () => { unlisten = await listenPanelStatus((next) => (status = next)); await panelAction('show'); })();
    return () => { unlisten?.(); if (expiryTimer) window.clearInterval(expiryTimer); window.removeEventListener('keydown', onKeyDown); window.removeEventListener('dragover', onDragOver); window.removeEventListener('drop', openDroppedFile); };
  });
</script>
<svelte:head><title>Edgedor</title></svelte:head>
<main class="shell">
  <ToolbarMount /><div class="controls"><button onclick={openTextFile}>打开文本</button><button onclick={openPreviewFile}>预览文件</button><select aria-label="编辑器快捷键方案" value={session.settings.shortcutProfile} onchange={setShortcutProfile}><option value="vscode">VS Code</option><option value="sublime">Sublime Text</option><option value="jetbrains">JetBrains</option><option value="vim">Vim</option></select><label><input type="checkbox" checked={session.settings.preserveOnRestart} onchange={setPreserveOnRestart} />重启保留</label><button class="pin" aria-pressed={pinned} onclick={togglePinned}>{pinned ? '取消固定' : '固定面板'}</button></div>
  <nav class="tabs" aria-label="编辑标签"><button class="add" onclick={newTab}>＋</button>{#each session.tabs as tab (tab.id)}<button class:active={tab.id === activeTab?.id} onclick={() => persist(focusTab(session, tab.id))}>{tab.title}</button>{/each}<button class="close" onclick={closeActive}>×</button><button class="restore" onclick={restoreClosed}>撤销关闭</button></nav>
  <section class="workspace" aria-label="临时编辑区">{#if activeTab}{#if activeTab.kind === 'preview'}<PreviewSurface dataUrl={activeTab.previewDataUrl ?? activeTab.content} mime={activeTab.previewMime ?? 'application/octet-stream'} />{:else}{#key `${activeTab.id}:${session.settings.fontSize}`}<EditorSurface tab={activeTab} fontSize={session.settings.fontSize} onChange={editContent} />{/key}{/if}{:else}<button class="empty" onclick={newTab}>新建临时标签</button>{/if}</section>
  <footer aria-live="polite">{status.bridgeReady ? '原生面板已连接' : '正在连接原生面板…'} · {session.tabs.length} 个标签</footer>
</main>
<style>
  :global(*) { box-sizing: border-box; }
  :global(html, body) { margin: 0; min-width: 320px; height: 100%; }
  :global(body) { font-family: -apple-system, BlinkMacSystemFont, sans-serif; background: transparent; color: var(--text); }
  :global(:root) { color-scheme: light dark; --text: #1d1d1f; --muted: #6e6e73; --panel: rgba(255,255,255,.88); }
  @media (prefers-color-scheme: dark) { :global(:root) { --text: #f5f5f7; --muted: #a1a1a6; --panel: rgba(30,30,32,.92); } }
  .shell { height: 100vh; display: flex; flex-direction: column; overflow: hidden; background: var(--panel); }
  .tabs { display: flex; align-items: center; gap: 4px; padding: 0 10px 8px; overflow-x: auto; }
  .pin { align-self: flex-end; margin: -4px 12px 6px; border: 0; border-radius: 6px; padding: 4px 8px; color: var(--muted); background: transparent; font-size: 11px; }
  .controls { display: flex; justify-content: flex-end; align-items: center; gap: 6px; padding: 0 12px 4px; }
  .controls select { border: 0; border-radius: 6px; padding: 4px 6px; color: var(--muted); background: transparent; font-size: 11px; }
  .controls label { color: var(--muted); font-size: 11px; }
  .tabs button { border: 0; border-radius: 7px; padding: 5px 9px; background: transparent; color: var(--muted); white-space: nowrap; }
  .tabs button.active { color: var(--text); background: color-mix(in srgb, var(--text) 12%, transparent); }
  .tabs .add, .tabs .close { font-size: 18px; padding-inline: 7px; }
  .tabs .restore { margin-left: auto; font-size: 11px; }
  .workspace { min-height: 0; flex: 1; display: flex; }
  .empty { margin: auto; border: 0; border-radius: 8px; padding: 10px 14px; }
  footer { padding: 6px 16px 10px; font-size: 11px; color: var(--muted); }
</style>
