<script lang="ts">
  import { onMount } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { open, save } from '@tauri-apps/plugin-dialog';
  import EditorSurface from '../components/EditorSurface.svelte';
  import PreviewSurface from '../components/PreviewSurface.svelte';
  import ToolbarMount from '../components/ToolbarMount.svelte';
  import { listenPanelStatus, panelAction, type PanelStatus } from '../lib/tauri/panel';
  import { addTab, closeTab, createGroup, createSessionState, createTab, deserializeSession, expireTabs, focusTab, removeGroup, restoreLatest, serializeSession, setGroupRatio, updateTab, type EditorGroup, type EditorSnapshot, type SessionState, type SessionTab } from '../lib/session';
  import type { EditorCommand } from '../lib/shortcuts';
  let status: PanelStatus = { visible: true, focused: true, bridgeReady: false };
  let pinned = false;
  let session: SessionState = createSessionState();
  let activeTab: SessionTab | undefined;
  let unlisten: (() => void) | undefined;
  let expiryTimer: number | undefined;
  let showSettings = false;
  let showSearch = false;
  let searchQuery = '';
  let searchInput: HTMLInputElement;
  let notice = '';
  let noticeTimer: number | undefined;
  const editorShortcutCommands: Array<{ id: EditorCommand; label: string }> = [
    { id: 'selectNextOccurrence', label: '逐个选择相同内容' },
    { id: 'selectAllOccurrences', label: '选择所有相同内容' },
    { id: 'addCursorAbove', label: '上方添加光标' },
    { id: 'addCursorBelow', label: '下方添加光标' },
    { id: 'moveLineUp', label: '上移行' },
    { id: 'moveLineDown', label: '下移行' },
    { id: 'deleteLine', label: '删除行' },
    { id: 'toggleComment', label: '切换行注释' }
  ];
  $: activeTab = session.tabs.find((tab) => tab.id === session.groups.find((group) => group.id === session.activeGroupId)?.activeTabId);
  function persist(next: SessionState) { session = next; if (session.settings.preserveOnRestart) localStorage.setItem('edgedor.session', serializeSession(session)); else localStorage.removeItem('edgedor.session'); }
  function newTab() { persist(addTab(session, createTab())); }
  function closeTabById(tabId: string) {
    const tab = session.tabs.find((candidate) => candidate.id === tabId);
    if (!tab) return;
    persist(closeTab(session, tabId));
    showNotice(`${tab.title} 已关闭，可用“撤销关闭”恢复`);
  }
  function closeActive() { if (activeTab) closeTabById(activeTab.id); }
  function renameTab(tabId: string) {
    const tab = session.tabs.find((candidate) => candidate.id === tabId);
    if (!tab) return;
    const title = window.prompt('重命名标签', tab.title)?.trim();
    if (title) persist(updateTab(session, tabId, { title, manuallyNamed: true }));
  }
  function restoreClosed() {
    const slot = session.undoSlots[0];
    if (!slot) { showNotice('没有可撤销的关闭标签'); return; }
    persist(restoreLatest(session));
    showNotice(`${slot.tab.title} 已恢复${slot.reason === 'expired' ? '（原标签已超时）' : ''}`);
  }
  function showNotice(message: string) {
    notice = message;
    if (noticeTimer) window.clearTimeout(noticeTimer);
    noticeTimer = window.setTimeout(() => { notice = ''; }, 4200);
  }
  function editContentFor(tabId: string, content: string) { persist(updateTab(session, tabId, { content })); }
  function editContent(content: string) { if (activeTab) editContentFor(activeTab.id, content); }
  function editStateFor(tabId: string, editor: EditorSnapshot) { persist(updateTab(session, tabId, { editor })); }
  async function saveActive() {
    if (!activeTab) return;
    const path = activeTab.filePath ?? await save({ defaultPath: `${activeTab.title.replace(/[^\w.-]+/g, '-')}.txt`, filters: [{ name: '文本文件', extensions: ['txt', 'md', 'json', 'js', 'ts', 'rs', 'py'] }] });
    if (!path) return;
    try { await invoke('save_file', { path, content: activeTab.content, encoding: activeTab.encoding ?? 'utf-8', line_ending: activeTab.lineEnding ?? '\n' }); persist(updateTab(session, activeTab.id, { filePath: path, kind: 'file', title: path.split('/').at(-1) ?? activeTab.title, manuallyNamed: true, dirty: false })); showNotice(`${path.split('/').at(-1) ?? '文件'} 已保存`); }
    catch (error) { window.alert(`保存失败：${String(error)}`); }
  }
  async function togglePinned() { pinned = !pinned; persist({ ...session, settings: { ...session.settings, pinned } }); await invoke('set_panel_pinned', { pinned }); }
  function setShortcutProfile(event: Event) { const value = (event.currentTarget as HTMLSelectElement).value as SessionState['settings']['shortcutProfile']; persist({ ...session, settings: { ...session.settings, shortcutProfile: value } }); }
  function setShortcutOverride(command: EditorCommand, event: Event) { const value = (event.currentTarget as HTMLInputElement).value.trim(); const shortcutOverrides = { ...session.settings.shortcutOverrides }; if (value) shortcutOverrides[command] = value; else delete shortcutOverrides[command]; persist({ ...session, settings: { ...session.settings, shortcutOverrides } }); }
  function setPreserveOnRestart(event: Event) { const preserve = (event.currentTarget as HTMLInputElement).checked; const next = { ...session, settings: { ...session.settings, preserveOnRestart: preserve } }; session = next; if (preserve) localStorage.setItem('edgedor.session', serializeSession(next)); else localStorage.removeItem('edgedor.session'); }
  async function setMenuBarIcon(event: Event) { const visible = (event.currentTarget as HTMLInputElement).checked; persist({ ...session, settings: { ...session.settings, showMenuBarIcon: visible } }); await invoke('set_menu_bar_icon_visible', { visible }); }
  async function setEdgeModifier(event: Event) {
    const modifier = (event.currentTarget as HTMLSelectElement).value as SessionState['settings']['edgeModifier'];
    persist({ ...session, settings: { ...session.settings, edgeModifier: modifier } });
    try { await invoke('set_edge_modifier', { modifier }); showNotice(`边缘触发键已改为 ${modifier}`); }
    catch { showNotice('设置已保存，原生边缘触发接口尚未连接'); }
  }
  function setTabLayout(event: Event) {
    const tabLayout = (event.currentTarget as HTMLSelectElement).value as SessionState['settings']['tabLayout'];
    persist({ ...session, settings: { ...session.settings, tabLayout } });
  }
  function changeFontSize(delta: number) { persist({ ...session, settings: { ...session.settings, fontSize: Math.max(10, Math.min(32, session.settings.fontSize + delta)) } }); }
  function openSettings() { showSettings = true; }
  function openSearch() { showSearch = true; window.setTimeout(() => searchInput?.focus(), 0); }
  function searchResults() {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return [];
    return session.tabs.flatMap((tab) => {
      const content = tab.content.toLowerCase();
      const index = content.indexOf(query);
      return index < 0 ? [] : [{ tab, index, excerpt: tab.content.slice(Math.max(0, index - 32), index + query.length + 48).replace(/\s+/g, ' ') }];
    });
  }
  function focusSearchResult(tabId: string) { persist(focusTab(session, tabId)); showSearch = false; }
  async function refreshPreview(tab: SessionTab) {
    if (!tab.filePath || tab.kind !== 'preview') return;
    try {
      const preview = await invoke<{ path: string; data_url: string; mime: string }>('preview_file', { path: tab.filePath });
      persist(updateTab(session, tab.id, { content: preview.data_url, previewDataUrl: preview.data_url, previewMime: preview.mime }));
      showNotice(`${tab.title} 已刷新`);
    } catch (error) { showNotice(`刷新失败：${String(error)}`); }
  }
  function clearWorkspace() {
    if (!window.confirm('清空所有标签和撤销槽？真实文件不会被删除。')) return;
    persist({ ...createSessionState(), settings: session.settings });
    showNotice('工作区已清空');
  }
  function addSplit() {
    if (session.groups.length >= 2) { showNotice('当前版本支持两个编辑分区'); return; }
    const next = createGroup(session, 'vertical');
    persist(addTab(next, createTab(), next.activeGroupId));
  }
  function closeSplit() {
    if (session.groups.length <= 1) { showNotice('当前只有一个编辑分区'); return; }
    persist(removeGroup(session, session.activeGroupId));
  }
  function groupTab(group: EditorGroup) { return session.tabs.find((tab) => tab.id === group.activeTabId); }
  function splitRatio() { return session.groups.find((group) => group.parentId)?.splitRatio ?? 0.5; }
  function setSplitRatio(event: Event) {
    const group = session.groups.find((candidate) => candidate.parentId);
    if (!group) return;
    persist(setGroupRatio(session, group.id, Number((event.currentTarget as HTMLInputElement).value)));
  }
  function groupStyle(index: number) {
    if (session.groups.length !== 2) return '';
    const ratio = splitRatio();
    return `flex: ${index === 0 ? 1 - ratio : ratio};`;
  }
  function isPreviewPath(path: string) { return /\.(png|jpe?g|gif|webp|pdf)$/i.test(path); }
  async function addPreviewPath(path: string, title?: string) {
    const preview = await invoke<{ path: string; data_url: string; mime: string }>('preview_file', { path });
    persist(addTab(session, createTab({ kind: 'preview', filePath: preview.path, content: preview.data_url, language: 'preview', title: title ?? path.split('/').at(-1), readOnly: true, previewDataUrl: preview.data_url, previewMime: preview.mime })));
  }
  async function rehydratePreviews(next: SessionState) {
    const previews = next.tabs.filter((tab) => tab.kind === 'preview' && tab.filePath);
    for (const tab of previews) {
      try {
        const preview = await invoke<{ path: string; data_url: string; mime: string }>('preview_file', { path: tab.filePath });
        next = updateTab(next, tab.id, { content: preview.data_url, previewDataUrl: preview.data_url, previewMime: preview.mime, readOnly: true });
      } catch {
        next = closeTab(next, tab.id, Date.now(), 'closed');
        showNotice(`${tab.title} 无法恢复，已关闭`);
      }
    }
    if (next !== session) persist(next);
  }
  async function openPath(path: string, title?: string) {
    if (isPreviewPath(path)) {
      try { await addPreviewPath(path, title); } catch (error) { window.alert(`不支持预览此文件：${String(error)}`); }
      return;
    }
    try {
      const opened = await invoke<{ path: string; content: string; language: string; encoding: string; line_ending: '\n' | '\r\n' | '\r' }>('open_text_file', { path });
      persist(addTab(session, createTab({ kind: 'file', filePath: opened.path, content: opened.content, language: opened.language, encoding: opened.encoding, lineEnding: opened.line_ending, title: title ?? path.split('/').at(-1) })));
    } catch (textError) {
      try { await addPreviewPath(path, title); } catch { window.alert(`不支持打开此文件：${String(textError)}`); }
    }
  }
  async function openTextFile() {
    const path = await open({ multiple: false, directory: false });
    if (!path) return;
    const selectedPath = Array.isArray(path) ? path[0] : path;
    if (!selectedPath) return;
    await openPath(selectedPath);
  }
  async function openPreviewFile() {
    const path = await open({ multiple: false, directory: false });
    const selectedPath = Array.isArray(path) ? path[0] : path;
    if (!selectedPath) return;
    try { await addPreviewPath(selectedPath); } catch (error) { window.alert(`不支持预览此文件：${String(error)}`); }
  }
  async function openDroppedFile(event: DragEvent) {
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0] as (File & { path?: string }) | undefined;
    if (file?.path) {
      await openPath(file.path, file.name);
    }
  }
  onMount(() => {
    const saved = deserializeSession(localStorage.getItem('edgedor.session') ?? '');
    if (saved && !saved.settings.preserveOnRestart) localStorage.removeItem('edgedor.session');
    const restored = saved?.settings.preserveOnRestart ? saved : addTab(session, createTab());
    const restoredActiveTabId = restored.groups.find((group) => group.id === restored.activeGroupId)?.activeTabId;
    session = restoredActiveTabId ? focusTab(restored, restoredActiveTabId) : restored;
    void rehydratePreviews(session);
    pinned = session.settings.pinned;
    void invoke('set_menu_bar_icon_visible', { visible: session.settings.showMenuBarIcon });
    void invoke('set_panel_pinned', { pinned });
    void invoke('set_edge_modifier', { modifier: session.settings.edgeModifier });
    expiryTimer = window.setInterval(() => { const result = expireTabs(session); if (result.expired.length) { persist(result.state); showNotice(`${result.expired.length} 个未访问标签已超时，已放入撤销槽`); } }, 60_000);
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') { event.preventDefault(); void saveActive(); }
      if ((event.metaKey || event.ctrlKey) && (event.key === '+' || event.key === '=')) { event.preventDefault(); changeFontSize(1); }
      if ((event.metaKey || event.ctrlKey) && event.key === '-') { event.preventDefault(); changeFontSize(-1); }
      if ((event.metaKey || event.ctrlKey) && event.key === '0') { event.preventDefault(); persist({ ...session, settings: { ...session.settings, fontSize: 14 } }); }
      if ((event.metaKey || event.ctrlKey) && !event.shiftKey && event.key.toLowerCase() === 'n') { event.preventDefault(); newTab(); }
      if ((event.metaKey || event.ctrlKey) && !event.shiftKey && event.key.toLowerCase() === 'w') { event.preventDefault(); closeActive(); }
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 't') { event.preventDefault(); restoreClosed(); }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'q') { event.preventDefault(); void invoke('quit_app'); }
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 'f') { event.preventDefault(); openSearch(); }
      if ((event.metaKey || event.ctrlKey) && event.key === ',') { event.preventDefault(); (document.querySelector('select[aria-label="编辑器快捷键方案"]') as HTMLSelectElement | null)?.focus(); }
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
<main class="shell" class:side-tabs={session.settings.tabLayout !== 'top'} class:side-tabs-right={session.settings.tabLayout === 'right'}>
  <ToolbarMount />
  <header class="toolbar" aria-label="工作台工具栏">
    <button onclick={newTab} title="新建临时标签">＋ 新建</button>
    <button onclick={openTextFile}>打开文件</button>
    <button onclick={openPreviewFile}>预览文件</button>
    <button onclick={saveActive} disabled={!activeTab || activeTab.kind === 'preview'} title="保存当前标签（⌘S）">保存{activeTab?.dirty ? ' ·' : ''}</button>
    <button onclick={addSplit} disabled={session.groups.length >= 2} title="新建编辑分区（最多两个）">分区</button>
    <button onclick={closeSplit} disabled={session.groups.length <= 1} title="合并当前编辑分区">合并</button>
    <span class="toolbar-spacer"></span>
    <button onclick={openSearch} title="跨标签查找（⌘⇧F）">查找</button>
    <button onclick={openSettings} aria-haspopup="dialog">设置</button>
    <button class="pin" aria-pressed={pinned} onclick={togglePinned}>{pinned ? '取消固定' : '固定面板'}</button>
  </header>
  <nav class="tabs" aria-label="编辑标签">
    {#each session.tabs as tab (tab.id)}
      <div class:active={tab.id === activeTab?.id} class="tab-wrap">
        <button class="tab" onclick={() => persist(focusTab(session, tab.id))} ondblclick={(event) => { event.stopPropagation(); renameTab(tab.id); }} title={`${tab.filePath ?? tab.title}（双击重命名）`}>{tab.dirty ? '● ' : ''}{tab.title}{tab.kind === 'preview' ? ' · 预览' : ''}</button>
        <button class="tab-close" aria-label={`关闭 ${tab.title}`} onclick={(event) => { event.stopPropagation(); closeTabById(tab.id); }}>×</button>
      </div>
    {/each}
    {#if session.tabs.length === 0}<button class="empty-tab" onclick={newTab}>新建临时标签</button>{/if}
    <button class="restore" onclick={restoreClosed} disabled={session.undoSlots.length === 0} title={session.undoSlots[0] ? `${session.undoSlots[0].tab.title} · ${session.undoSlots[0].reason === 'expired' ? '超时' : '关闭'}` : '没有撤销记录'}>撤销关闭{session.undoSlots.length ? ` (${session.undoSlots.length})` : ''}</button>
  </nav>
  <section class:split-workspace={session.groups.length > 1} class="workspace" aria-label="临时编辑区">
    {#each session.groups as group (group.id)}
      {@const tab = groupTab(group)}
      <section class="editor-group" style={groupStyle(session.groups.indexOf(group))} aria-label={`编辑分区 ${group.id}`}>
        {#if tab}
          {#if tab.kind === 'preview'}<PreviewSurface dataUrl={tab.previewDataUrl ?? tab.content} mime={tab.previewMime ?? 'application/octet-stream'} onRefresh={() => refreshPreview(tab)} />{:else}{#key `${tab.id}:${session.settings.fontSize}:${session.settings.shortcutProfile}`}<EditorSurface tab={tab} fontSize={session.settings.fontSize} shortcutProfile={session.settings.shortcutProfile} shortcutOverrides={session.settings.shortcutOverrides} onChange={(content) => editContentFor(tab.id, content)} onStateChange={(editor) => editStateFor(tab.id, editor)} />{/key}{/if}
        {:else}<button class="empty" onclick={() => { const next = addTab(session, createTab(), group.id); persist(next); }}>新建分区标签</button>{/if}
      </section>
    {/each}
  </section>
  {#if notice}<div class="notice" role="status">{notice}</div>{/if}
  <footer aria-live="polite">{status.bridgeReady ? '原生面板已连接' : '正在连接原生面板…'} · {session.tabs.length} 个标签 · 撤销槽 {session.undoSlots.length}/10</footer>
  {#if showSearch}
    <div class="search-backdrop" role="presentation" onclick={(event) => { if (event.target === event.currentTarget) showSearch = false; }}>
      <div class="search-panel" role="dialog" aria-modal="true" aria-label="跨标签查找">
        <div class="settings-heading"><h2>跨标签查找</h2><button aria-label="关闭查找" onclick={() => showSearch = false}>×</button></div>
        <input bind:this={searchInput} bind:value={searchQuery} placeholder="输入要查找的内容" aria-label="查找内容" />
        <div class="search-results">
          {#if searchQuery.trim() && searchResults().length === 0}<p>没有匹配内容</p>{/if}
          {#each searchResults() as result (result.tab.id)}
            <button class="search-result" onclick={() => focusSearchResult(result.tab.id)}><strong>{result.tab.title}</strong><span>{result.excerpt}</span></button>
          {/each}
        </div>
      </div>
    </div>
  {/if}
  {#if showSettings}
    <div class="settings-backdrop" role="presentation" onclick={(event) => { if (event.target === event.currentTarget) showSettings = false; }}>
      <div class="settings-panel" role="dialog" aria-modal="true" aria-label="Edgedor 设置">
        <div class="settings-heading"><h2>设置</h2><button aria-label="关闭设置" onclick={() => showSettings = false}>×</button></div>
        <label>编辑器快捷键方案<select aria-label="编辑器快捷键方案" value={session.settings.shortcutProfile} onchange={setShortcutProfile}><option value="vscode">VS Code</option><option value="sublime">Sublime Text</option><option value="jetbrains">JetBrains</option><option value="vim">Vim（编辑区）</option></select></label>
        <label>边缘呼出修饰键<select aria-label="边缘呼出修饰键" value={session.settings.edgeModifier} onchange={setEdgeModifier}><option value="command">Command（⌘）</option><option value="option">Option（⌥）</option><option value="control">Control（⌃）</option><option value="shift">Shift（⇧）</option></select></label>
        <label>标签布局<select aria-label="标签布局" value={session.settings.tabLayout} onchange={setTabLayout}><option value="top">顶部横向滚动</option><option value="left">左侧标签</option><option value="right">右侧标签</option></select></label>
        {#if session.groups.length === 2}<label>分区比例 <input aria-label="分区比例" type="range" min="0.2" max="0.8" step="0.05" value={splitRatio()} oninput={setSplitRatio} /></label>{/if}
        <fieldset class="shortcut-list"><legend>自定义编辑器快捷键</legend>{#each editorShortcutCommands as shortcut}<label>{shortcut.label}<input aria-label={`${shortcut.label}快捷键`} placeholder="留空使用方案默认值" value={session.settings.shortcutOverrides[shortcut.id] ?? ''} onchange={(event) => setShortcutOverride(shortcut.id, event)} /></label>{/each}</fieldset>
        <label>编辑器字号 <span class="font-controls"><button onclick={() => changeFontSize(-1)}>−</button><output>{session.settings.fontSize}px</output><button onclick={() => changeFontSize(1)}>＋</button></span></label>
        <label class="checkbox"><input type="checkbox" checked={session.settings.preserveOnRestart} onchange={setPreserveOnRestart} />重启后恢复最后工作状态</label>
        <label class="checkbox"><input type="checkbox" checked={session.settings.showMenuBarIcon} onchange={setMenuBarIcon} />显示菜单栏图标</label>
        <p class="settings-note">临时标签 24 小时未访问会过期，并进入可撤销槽。文件只有触发保存时才写回原路径。</p>
        <button class="danger" onclick={clearWorkspace}>清空标签和撤销槽</button>
        <button class="done" onclick={() => showSettings = false}>完成</button>
      </div>
    </div>
  {/if}
</main>
<style>
  :global(*) { box-sizing: border-box; }
  :global(html, body) { margin: 0; min-width: 320px; height: 100%; }
  :global(body) { font-family: -apple-system, BlinkMacSystemFont, sans-serif; background: transparent; color: var(--text); }
  :global(:root) { color-scheme: light dark; --text: #1d1d1f; --muted: #6e6e73; --panel: rgba(255,255,255,.88); }
  @media (prefers-color-scheme: dark) { :global(:root) { --text: #f5f5f7; --muted: #a1a1a6; --panel: rgba(30,30,32,.92); } }
  .shell { height: 100vh; display: flex; flex-direction: column; overflow: hidden; background: var(--panel); }
  .shell.side-tabs { display: grid; grid-template-columns: 126px minmax(0, 1fr); grid-template-rows: auto minmax(0, 1fr) auto; }
  .shell.side-tabs.side-tabs-right { grid-template-columns: minmax(0, 1fr) 126px; }
  .shell.side-tabs .toolbar { grid-column: 1 / -1; }
  .shell.side-tabs .tabs { grid-column: 1; grid-row: 2; flex-direction: column; align-items: stretch; overflow-x: hidden; overflow-y: auto; padding: 8px 6px; }
  .shell.side-tabs.side-tabs-right .tabs { grid-column: 2; }
  .shell.side-tabs .workspace { grid-column: 2; grid-row: 2; }
  .shell.side-tabs.side-tabs-right .workspace { grid-column: 1; }
  .shell.side-tabs .tab-wrap { width: 100%; min-width: 0; }
  .shell.side-tabs .tab { min-width: 0; flex: 1; overflow: hidden; text-overflow: ellipsis; text-align: left; }
  .shell.side-tabs .tabs .restore { margin-top: auto; margin-left: 0; }
  .shell.side-tabs footer { grid-column: 1 / -1; grid-row: 3; }
  .toolbar { display: flex; align-items: center; gap: 5px; padding: 8px 12px 4px; }
  .toolbar button, .settings-panel button { border: 0; border-radius: 7px; padding: 5px 9px; color: var(--muted); background: color-mix(in srgb, var(--text) 7%, transparent); font-size: 11px; }
  .toolbar button:hover, .settings-panel button:hover, .tab-close:hover { color: var(--text); background: color-mix(in srgb, var(--text) 14%, transparent); }
  .toolbar button:disabled { opacity: .4; }
  .toolbar-spacer { flex: 1; }
  .tabs { display: flex; align-items: center; gap: 3px; padding: 0 10px 8px; overflow-x: auto; }
  .tab-wrap { display: flex; align-items: center; border-radius: 7px; background: transparent; }
  .tab-wrap.active { background: color-mix(in srgb, var(--text) 12%, transparent); }
  .tab, .tab-close { border: 0; background: transparent; color: var(--muted); white-space: nowrap; }
  .tab { padding: 5px 3px 5px 9px; }
  .tab-close { padding: 4px 6px 4px 2px; border-radius: 5px; }
  .pin { align-self: flex-end; margin: -4px 12px 6px; border: 0; border-radius: 6px; padding: 4px 8px; color: var(--muted); background: transparent; font-size: 11px; }
  .tabs .restore { margin-left: auto; font-size: 11px; }
  .empty-tab { border: 0; border-radius: 7px; padding: 5px 9px; color: var(--muted); background: transparent; }
  .workspace { min-height: 0; flex: 1; display: flex; }
  .split-workspace { gap: 1px; background: color-mix(in srgb, var(--text) 12%, transparent); }
  .editor-group { min-width: 0; min-height: 0; flex: 1; display: flex; background: var(--panel); }
  .empty { margin: auto; border: 0; border-radius: 8px; padding: 10px 14px; }
  .notice { position: absolute; left: 50%; bottom: 34px; transform: translateX(-50%); max-width: calc(100% - 24px); padding: 7px 12px; border-radius: 9px; color: var(--text); background: color-mix(in srgb, var(--panel) 88%, var(--text)); box-shadow: 0 5px 25px rgba(0,0,0,.18); font-size: 12px; }
  footer { padding: 6px 16px 10px; font-size: 11px; color: var(--muted); }
  .settings-backdrop { position: fixed; inset: 0; z-index: 10; display: flex; justify-content: flex-end; background: rgba(0,0,0,.16); }
  .search-backdrop { position: fixed; inset: 0; z-index: 11; display: grid; place-items: start center; padding-top: 12vh; background: rgba(0,0,0,.16); }
  .search-panel { width: min(620px, 90vw); max-height: 70vh; padding: 16px; display: flex; flex-direction: column; gap: 12px; color: var(--text); background: var(--panel); border-radius: 12px; box-shadow: 0 16px 45px rgba(0,0,0,.25); }
  .search-panel > input { border: 1px solid color-mix(in srgb, var(--text) 15%, transparent); border-radius: 7px; padding: 9px; color: var(--text); background: color-mix(in srgb, var(--text) 5%, transparent); }
  .search-results { min-height: 0; overflow: auto; display: flex; flex-direction: column; gap: 5px; }
  .search-results p { margin: 8px 0; color: var(--muted); font-size: 12px; }
  .search-result { display: flex; flex-direction: column; align-items: flex-start; gap: 3px; border: 0; border-radius: 7px; padding: 8px; text-align: left; color: var(--text); background: color-mix(in srgb, var(--text) 5%, transparent); }
  .search-result span { color: var(--muted); font: 11px/1.4 ui-monospace, monospace; }
  .settings-panel { width: min(360px, 90vw); height: 100%; padding: 20px; display: flex; flex-direction: column; gap: 16px; color: var(--text); background: var(--panel); box-shadow: -10px 0 30px rgba(0,0,0,.15); }
  .settings-heading { display: flex; align-items: center; justify-content: space-between; }
  .settings-heading h2 { margin: 0; font-size: 18px; }
  .settings-heading button { padding: 2px 8px; font-size: 20px; }
  .settings-panel label { display: flex; flex-direction: column; gap: 6px; color: var(--muted); font-size: 12px; }
  .shortcut-list { min-width: 0; margin: 0; padding: 10px; display: flex; flex-direction: column; gap: 10px; border: 1px solid color-mix(in srgb, var(--text) 14%, transparent); border-radius: 8px; }
  .shortcut-list legend { padding: 0 4px; color: var(--muted); font-size: 12px; }
  .settings-panel select, .settings-panel input:not([type="checkbox"]) { border: 1px solid color-mix(in srgb, var(--text) 15%, transparent); border-radius: 7px; padding: 7px; color: var(--text); background: color-mix(in srgb, var(--text) 5%, transparent); }
  .settings-panel .checkbox { flex-direction: row; align-items: center; }
  .font-controls { display: flex; align-items: center; gap: 8px; }
  .font-controls output { min-width: 44px; text-align: center; color: var(--text); }
  .settings-note { margin: auto 0 0; color: var(--muted); font-size: 11px; line-height: 1.5; }
  .settings-panel .done { width: 100%; padding: 8px; color: var(--text); }
  .settings-panel .danger { color: #b42318; }
</style>
