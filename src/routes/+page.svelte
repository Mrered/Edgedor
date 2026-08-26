<script lang="ts">
  import { onMount } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { listen } from '@tauri-apps/api/event';
  import { getCurrentWebview } from '@tauri-apps/api/webview';
  import { open, save } from '@tauri-apps/plugin-dialog';
  import { enable as enableAutostart, disable as disableAutostart, isEnabled as isAutostartEnabled } from '@tauri-apps/plugin-autostart';
  import { check } from '@tauri-apps/plugin-updater';
  import { relaunch } from '@tauri-apps/plugin-process';
  import EditorSurface from '../components/EditorSurface.svelte';
  import PreviewSurface from '../components/PreviewSurface.svelte';
  import ToolbarMount from '../components/ToolbarMount.svelte';
  import { listenPanelStatus, panelAction, type PanelStatus } from '../lib/tauri/panel';
  import { createTranslator } from '../lib/i18n';
  import { DEFAULT_SESSION_SETTINGS, MAX_EDITOR_GROUPS, MIN_GROUP_RATIO, addTab, applySaveResult, captureSaveRequest, clearSessionCheckpoint, closeTab, createGroup, createSessionState, createTab, expireTabs, focusTab, moveTabToGroup, persistSessionSettings, readStartupState, removeGroup, resizeAdjacentGroups, restoreLatest, touchTab, updateTab, writeSessionCheckpoint, type EditorGroup, type EditorSnapshot, type SessionSettings, type SessionState, type SessionTab } from '../lib/session';
  import { validateShortcut, type EditorCommand } from '../lib/shortcuts';
  import { editorModelRegistry } from '../lib/editor/monaco';
  let status: PanelStatus = { visible: true, focused: true, bridgeReady: false };
  let pinned = false;
  let session: SessionState = createSessionState();
  let activeTab: SessionTab | undefined;
  let unlisten: (() => void) | undefined;
  let unlistenPaths: (() => void) | undefined;
  let unlistenQuit: (() => void) | undefined;
  let panelStatusInitialized = false;
  let quitInProgress = false;
  let expiryTimer: number | undefined;
  let showSettings = false;
  let showSearch = false;
  let showCommands = false;
  let searchQuery = '';
  let commandQuery = '';
  let searchInput: HTMLInputElement;
  let settingsCloseButton: HTMLButtonElement;
  let searchCloseButton: HTMLButtonElement;
  let commandInput: HTMLInputElement;
  let commandIndex = 0;
  let overlayOrigin: HTMLElement | null = null;
  let draggedTabId = '';
  let workspaceElement: HTMLElement;
  let separatorDrag: {
    pointerId: number;
    separatorIndex: number;
    element: HTMLElement;
    startPosition: number;
    containerSize: number;
    initialLeadingWeight: number;
  } | undefined;
  let notice = '';
  let noticeTimer: number | undefined;
  const t = createTranslator();
  const INTERNAL_TAB_MIME = 'application/x-edgedor-tab';
  const languageOptions = ['plaintext', 'javascript', 'typescript', 'json', 'html', 'css', 'markdown', 'python', 'rust', 'go', 'java', 'c', 'cpp', 'csharp', 'shell', 'sql', 'yaml', 'xml'];
  const editorShortcutCommands: Array<{ id: EditorCommand; label: string }> = [
    { id: 'selectNextOccurrence', label: t('selectNextOccurrence') },
    { id: 'selectAllOccurrences', label: t('selectAllOccurrences') },
    { id: 'addCursorAbove', label: t('addCursorAbove') },
    { id: 'addCursorBelow', label: t('addCursorBelow') },
    { id: 'moveLineUp', label: t('moveLineUp') },
    { id: 'moveLineDown', label: t('moveLineDown') },
    { id: 'deleteLine', label: t('deleteLine') },
    { id: 'toggleComment', label: t('toggleComment') }
  ];
  $: activeTab = session.tabs.find((tab) => tab.id === session.groups.find((group) => group.id === session.activeGroupId)?.activeTabId);
  function applySession(next: SessionState) {
    session = next;
    editorModelRegistry.retain(next.tabs.map((tab) => tab.id));
  }
  function updateSettings(settings: SessionSettings) {
    applySession({ ...session, settings });
    persistSessionSettings(localStorage, settings);
  }
  function checkpoint(next: SessionState = session) {
    applySession(next);
    return writeSessionCheckpoint(localStorage, next);
  }
  function activeLocation(state: SessionState): string {
    const group = state.groups.find((candidate) => candidate.id === state.activeGroupId);
    return `${state.activeGroupId}:${group?.activeTabId ?? ''}`;
  }
  function applyActivation(next: SessionState) {
    if (activeLocation(next) === activeLocation(session)) applySession(next);
    else checkpoint(next);
  }
  function newTab() { applyActivation(addTab(session, createTab())); }
  function closeTabById(tabId: string) {
    const tab = session.tabs.find((candidate) => candidate.id === tabId);
    if (!tab) return;
    applyActivation(closeTab(session, tabId));
    showNotice(t('tabClosed', { name: tab.title }));
  }
  function closeActive() { if (activeTab) closeTabById(activeTab.id); }
  function renameTab(tabId: string) {
    const tab = session.tabs.find((candidate) => candidate.id === tabId);
    if (!tab) return;
    const title = window.prompt(t('renameTab'), tab.title)?.trim();
    if (title) applySession(updateTab(session, tabId, { title, manuallyNamed: true }));
  }
  function restoreClosed() {
    const slot = session.undoSlots[0];
    if (!slot) { showNotice(t('nothingToRestore')); return; }
    applyActivation(restoreLatest(session));
    showNotice(t(slot.reason === 'expired' ? 'tabRestoredExpired' : 'tabRestored', { name: slot.tab.title }));
  }
  function showNotice(message: string) {
    notice = message;
    if (noticeTimer) window.clearTimeout(noticeTimer);
    noticeTimer = window.setTimeout(() => { notice = ''; }, 4200);
  }
  function detectLanguage(content: string): string {
    const sample = content.trimStart().slice(0, 4000);
    if (!sample) return 'plaintext';
    if (/^\s*(?:#!.*(?:bash|zsh|sh)|(?:export|set)\s+\w+=)/m.test(sample)) return 'shell';
    if (/^\s*(?:fn\s+\w+|use\s+\w+::|impl(?:<.*>)?\s+\w+)/m.test(sample)) return 'rust';
    if (/^\s*(?:def\s+\w+|from\s+\w+\s+import|import\s+\w+)/m.test(sample) && /:\s*(?:#.*)?$/m.test(sample)) return 'python';
    if (/^\s*(?:package\s+\w+|func\s+\w+\s*\()/m.test(sample)) return 'go';
    if (/^\s*<[!a-zA-Z][\s\S]*>/.test(sample)) return 'html';
    if (/^\s*[\[{][\s\S]*[\]}]\s*$/.test(sample)) { try { JSON.parse(sample); return 'json'; } catch { /* continue */ } }
    if (/\b(?:const|let|var|function|interface|type|import|export)\b/.test(sample)) return /:\s*(?:string|number|boolean|unknown|any)\b|\binterface\b|\btype\s+\w+\s*=/.test(sample) ? 'typescript' : 'javascript';
    if (/^\s*#{1,6}\s+\S|```/m.test(sample)) return 'markdown';
    return 'plaintext';
  }
  function editContentFor(tabId: string, content: string) {
    const tab = session.tabs.find((candidate) => candidate.id === tabId);
    const language = tab?.kind === 'temporary' && !tab.languageManuallySelected ? detectLanguage(content) : tab?.language;
    applySession(touchTab(updateTab(session, tabId, { content, ...(language ? { language } : {}) }), tabId));
  }
  function editContent(content: string) { if (activeTab) editContentFor(activeTab.id, content); }
  function editStateFor(tabId: string, editor: EditorSnapshot) { applySession(updateTab(session, tabId, { editor })); }
  async function saveActive() {
    if (!activeTab) return;
    const request = captureSaveRequest(activeTab);
    const path = request.filePath ?? await save({ defaultPath: `${request.title.replace(/[^\w.-]+/g, '-')}.txt`, filters: [{ name: t('textFiles'), extensions: ['txt', 'md', 'json', 'js', 'ts', 'rs', 'py'] }] });
    if (!path) return;
    try { await invoke('save_file', { path, content: request.content, encoding: request.encoding ?? 'utf-8', lineEnding: request.lineEnding ?? '\n' }); applySession(applySaveResult(session, request, path)); showNotice(t('fileSaved', { name: path.split('/').at(-1) ?? t('unnamedFile') })); }
    catch (error) { window.alert(`${t('saveFailed')}${String(error)}`); }
  }
  async function togglePinned() { pinned = !pinned; updateSettings({ ...session.settings, pinned }); await invoke('set_panel_pinned', { pinned }); }
  function setShortcutProfile(event: Event) { const value = (event.currentTarget as HTMLSelectElement).value as SessionState['settings']['shortcutProfile']; updateSettings({ ...session.settings, shortcutProfile: value }); }
  function normalizedShortcutBinding(binding: string): string {
    const aliases: Record<string, string> = { command: 'cmd', meta: 'cmd', cmdorctrl: 'cmd', control: 'ctrl', option: 'alt' };
    const modifierOrder = ['cmd', 'ctrl', 'alt', 'shift'];
    const parts = binding.toLowerCase().split('+').map((part) => aliases[part] ?? part);
    const key = parts.at(-1) ?? '';
    const modifiers = parts.slice(0, -1).sort((first, second) => modifierOrder.indexOf(first) - modifierOrder.indexOf(second));
    return [...modifiers, key].join('+');
  }
  function setShortcutOverride(command: EditorCommand, event: Event) { const raw = (event.currentTarget as HTMLInputElement).value; const value = validateShortcut(raw); const shortcutOverrides = { ...session.settings.shortcutOverrides }; if (raw.trim() && !value) { showNotice(t('invalidShortcut')); (event.currentTarget as HTMLInputElement).value = shortcutOverrides[command] ?? ''; return; } if (value && Object.entries(shortcutOverrides).some(([id, binding]) => id !== command && normalizedShortcutBinding(binding) === normalizedShortcutBinding(value))) { showNotice(t('shortcutConflict')); (event.currentTarget as HTMLInputElement).value = shortcutOverrides[command] ?? ''; return; } if (value) shortcutOverrides[command] = value; else delete shortcutOverrides[command]; updateSettings({ ...session.settings, shortcutOverrides }); }
  function setPreserveOnRestart(event: Event) { updateSettings({ ...session.settings, preserveOnRestart: (event.currentTarget as HTMLInputElement).checked }); }
  async function setMenuBarIcon(event: Event) { const visible = (event.currentTarget as HTMLInputElement).checked; updateSettings({ ...session.settings, showMenuBarIcon: visible }); await invoke('set_menu_bar_icon_visible', { visible }); }
  async function setDockIcon(event: Event) {
    const visible = (event.currentTarget as HTMLInputElement).checked;
    try { await invoke('set_dock_icon_visible', { visible }); updateSettings({ ...session.settings, showDockIcon: visible }); }
    catch (error) { (event.currentTarget as HTMLInputElement).checked = false; showNotice(`${t('dockSettingFailed')}${String(error)}`); }
  }
  async function setLaunchAtLogin(event: Event) {
    const enabled = (event.currentTarget as HTMLInputElement).checked;
    try {
      if (enabled) await enableAutostart(); else await disableAutostart();
      updateSettings({ ...session.settings, launchAtLogin: enabled });
    } catch (error) {
      (event.currentTarget as HTMLInputElement).checked = false;
      showNotice(`${t('loginSettingFailed')}${String(error)}`);
    }
  }
  async function setEdgeModifier(event: Event) {
    const modifier = (event.currentTarget as HTMLSelectElement).value as SessionState['settings']['edgeModifier'];
    updateSettings({ ...session.settings, edgeModifier: modifier });
    try { await invoke('set_edge_modifier', { modifier }); showNotice(t('modifierChanged', { modifier })); }
    catch { showNotice(t('nativeTriggerUnavailable')); }
  }
  function setTabLayout(event: Event) {
    const tabLayout = (event.currentTarget as HTMLSelectElement).value as SessionState['settings']['tabLayout'];
    updateSettings({ ...session.settings, tabLayout });
  }
  function setTopTabBehavior(event: Event) {
    const topTabBehavior = (event.currentTarget as HTMLSelectElement).value as SessionState['settings']['topTabBehavior'];
    updateSettings({ ...session.settings, topTabBehavior });
  }
  function setLanguage(tabId: string, event: Event) {
    const language = (event.currentTarget as HTMLSelectElement).value;
    applySession(updateTab(session, tabId, { language, languageManuallySelected: true }));
  }
  async function setEdgeOptions() {
    try { await invoke('set_edge_trigger_options', { leftEnabled: session.settings.leftEdgeEnabled, rightEnabled: session.settings.rightEdgeEnabled, dwellMs: session.settings.edgeDwellMs }); }
    catch (error) { showNotice(String(error)); }
  }
  function updateEdgeOption(key: 'leftEdgeEnabled' | 'rightEdgeEnabled' | 'edgeDwellMs', value: boolean | number) {
    const settings = { ...session.settings, [key]: value };
    updateSettings(settings);
    void setEdgeOptions();
  }
  async function setAnimationOption(key: 'panelAnimationEnabled' | 'panelAnimationDurationMs', value: boolean | number) {
    const settings = { ...session.settings, [key]: value };
    updateSettings(settings);
    try { await invoke('set_panel_animation', { enabled: settings.panelAnimationEnabled, durationMs: settings.panelAnimationDurationMs }); }
    catch (error) { showNotice(String(error)); }
  }
  async function checkForUpdates() {
    try {
      const update = await check();
      if (!update) { showNotice(t('noUpdates')); return; }
      if (!window.confirm(t('updateFound', { version: update.version }))) return;
      await update.downloadAndInstall();
      checkpoint(session);
      await relaunch();
    } catch (error) { showNotice(`${t('updateFailed')}${String(error)}`); }
  }
  function changeFontSize(delta: number) { updateSettings({ ...session.settings, fontSize: Math.max(10, Math.min(32, session.settings.fontSize + delta)) }); }
  function setEditorVisibility(key: 'showLineNumbers' | 'showMinimap' | 'showFolding' | 'showGlyphMargin', event: Event) {
    updateSettings({ ...session.settings, [key]: (event.currentTarget as HTMLInputElement).checked });
  }
  function setDisplayVisibility(key: 'showTabs' | 'showBreadcrumbs' | 'showStatusBar', event: Event) {
    updateSettings({ ...session.settings, [key]: (event.currentTarget as HTMLInputElement).checked });
  }
  function openSettings() { overlayOrigin = document.activeElement as HTMLElement | null; showSettings = true; window.setTimeout(() => settingsCloseButton?.focus(), 0); }
  function closeSettings() { showSettings = false; overlayOrigin?.focus(); overlayOrigin = null; }
  function openSearch() { overlayOrigin = document.activeElement as HTMLElement | null; showSearch = true; window.setTimeout(() => searchInput?.focus(), 0); }
  function closeSearch() { showSearch = false; overlayOrigin?.focus(); overlayOrigin = null; }
  function openCommands() { overlayOrigin = document.activeElement as HTMLElement | null; commandQuery = ''; commandIndex = 0; showCommands = true; window.setTimeout(() => commandInput?.focus(), 0); }
  function closeCommands() { showCommands = false; overlayOrigin?.focus(); overlayOrigin = null; }
  const commandEntries = [
    { id: 'new', label: () => t('newTab'), run: () => newTab() },
    { id: 'save', label: () => t('save'), run: () => void saveActive() },
    { id: 'search', label: () => t('search'), run: () => openSearch() },
    { id: 'settings', label: () => t('settings'), run: () => openSettings() },
    { id: 'pin', label: () => pinned ? t('unpin') : t('pin'), run: () => void togglePinned() },
    { id: 'split', label: () => t('split'), run: () => addSplit() },
    { id: 'close', label: () => t('closed'), run: () => closeActive() }
  ];
  $: filteredCommands = commandEntries.filter((command) => command.label().toLocaleLowerCase().includes(commandQuery.trim().toLocaleLowerCase()));
  function runCommand(command: typeof commandEntries[number]) { closeCommands(); command.run(); }
  function searchResults() {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return [];
    return session.tabs.flatMap((tab) => {
      const content = tab.content.toLowerCase();
      const results: Array<{ tab: SessionTab; index: number; excerpt: string }> = [];
      let index = content.indexOf(query);
      while (index >= 0 && results.length < 100) {
        results.push({ tab, index, excerpt: tab.content.slice(Math.max(0, index - 32), index + query.length + 48).replace(/\s+/g, ' ') });
        index = content.indexOf(query, index + Math.max(query.length, 1));
      }
      return results;
    });
  }
  function focusSearchResult(tabId: string) { applyActivation(focusTab(session, tabId)); closeSearch(); }
  async function refreshPreview(tab: SessionTab) {
    if (!tab.filePath || tab.kind !== 'preview') return;
    try {
      const preview = await invoke<{ path: string; data_url: string; mime: string }>('preview_file', { path: tab.filePath });
      applySession(updateTab(session, tab.id, { content: preview.data_url, previewDataUrl: preview.data_url, previewMime: preview.mime }));
      showNotice(t('previewRefreshed', { name: tab.title }));
    } catch (error) { showNotice(`${t('refreshFailed')}${String(error)}`); }
  }
  function clearWorkspace() {
    if (!window.confirm(t('clearConfirm'))) return;
    applySession({ ...createSessionState(), settings: session.settings });
    clearSessionCheckpoint(localStorage);
    showNotice(t('workspaceCleared'));
  }
  async function resetSettings() {
    if (!window.confirm(t('resetConfirm'))) return;
    const settings = { ...DEFAULT_SESSION_SETTINGS, shortcutOverrides: {} };
    pinned = false;
    try { await disableAutostart(); } catch { /* autostart may be unavailable outside the packaged app */ }
    updateSettings(settings);
    await Promise.allSettled([
      invoke('set_menu_bar_icon_visible', { visible: settings.showMenuBarIcon }),
      invoke('set_dock_icon_visible', { visible: settings.showDockIcon }),
      invoke('set_panel_pinned', { pinned: false }),
      invoke('set_edge_modifier', { modifier: settings.edgeModifier })
    ]);
    showNotice(t('settingsReset'));
  }
  function addSplit() {
    if (session.groups.length >= MAX_EDITOR_GROUPS) { showNotice(t('splitLimit')); return; }
    const next = createGroup(session, session.splitOrientation);
    applyActivation(addTab(next, createTab(), next.activeGroupId));
  }
  function toggleSplitOrientation() {
    if (session.groups.length < 2) return;
    const splitOrientation = session.splitOrientation === 'vertical' ? 'horizontal' : 'vertical';
    applySession({ ...session, splitOrientation });
  }
  function closeSplit() {
    if (session.groups.length <= 1) { showNotice(t('oneGroupOnly')); return; }
    applyActivation(removeGroup(session, session.activeGroupId));
  }
  function cleanupTabDrag() { draggedTabId = ''; }
  function startTabDrag(tabId: string, event: DragEvent) {
    cleanupTabDrag();
    if (!session.tabs.some((tab) => tab.id === tabId)) return;
    draggedTabId = tabId;
    event.dataTransfer?.setData(INTERNAL_TAB_MIME, tabId);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }
  function internalTabId(event: DragEvent): string | undefined {
    const types = Array.from(event.dataTransfer?.types ?? []);
    if (!types.includes(INTERNAL_TAB_MIME)) return undefined;
    const fromTransfer = event.dataTransfer?.getData(INTERNAL_TAB_MIME) ?? '';
    const tabId = fromTransfer || draggedTabId;
    return tabId && session.tabs.some((tab) => tab.id === tabId) ? tabId : undefined;
  }
  function dragInternalTabOver(event: DragEvent) {
    if (!internalTabId(event)) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
  }
  function dropTabInGroup(groupId: string, event: DragEvent) {
    const tabId = internalTabId(event);
    if (!tabId) {
      if (Array.from(event.dataTransfer?.types ?? []).includes(INTERNAL_TAB_MIME)) cleanupTabDrag();
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    try {
      applyActivation(moveTabToGroup(session, tabId, groupId));
    } finally {
      cleanupTabDrag();
    }
  }
  function groupTab(group: EditorGroup) { return session.tabs.find((tab) => tab.id === group.activeTabId); }
  function groupStyle(group: EditorGroup) {
    return `flex-grow: ${group.splitRatio}; flex-basis: 0;`;
  }
  function separatorPosition(event: PointerEvent): number { return session.splitOrientation === 'vertical' ? event.clientX : event.clientY; }
  function cleanupSeparatorDrag() {
    const drag = separatorDrag;
    separatorDrag = undefined;
    if (drag?.element.hasPointerCapture(drag.pointerId)) drag.element.releasePointerCapture(drag.pointerId);
  }
  function startSeparatorDrag(separatorIndex: number, event: PointerEvent) {
    if (!event.isPrimary || event.button !== 0) return;
    cleanupSeparatorDrag();
    const leadingGroup = session.groups[separatorIndex];
    const bounds = workspaceElement.getBoundingClientRect();
    const containerSize = session.splitOrientation === 'vertical' ? bounds.width : bounds.height;
    if (!leadingGroup || containerSize <= 0) return;
    const element = event.currentTarget as HTMLElement;
    separatorDrag = {
      pointerId: event.pointerId,
      separatorIndex,
      element,
      startPosition: separatorPosition(event),
      containerSize,
      initialLeadingWeight: leadingGroup.splitRatio
    };
    element.setPointerCapture(event.pointerId);
    event.preventDefault();
  }
  function resizeFromPointer(event: PointerEvent) {
    const drag = separatorDrag;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const delta = (separatorPosition(event) - drag.startPosition) / drag.containerSize;
    applySession(resizeAdjacentGroups(session, drag.separatorIndex, drag.initialLeadingWeight + delta));
  }
  function finishSeparatorDrag(event: PointerEvent) {
    if (separatorDrag?.pointerId === event.pointerId) cleanupSeparatorDrag();
  }
  function separatorPairWeight(separatorIndex: number): number {
    return session.groups[separatorIndex].splitRatio + session.groups[separatorIndex + 1].splitRatio;
  }
  function separatorLeadingOffset(separatorIndex: number): number {
    return session.groups.slice(0, separatorIndex).reduce((sum, group) => sum + group.splitRatio, 0);
  }
  function separatorValue(separatorIndex: number): number {
    return separatorLeadingOffset(separatorIndex) + session.groups[separatorIndex].splitRatio;
  }
  function resizeSeparatorFromKeyboard(separatorIndex: number, event: KeyboardEvent) {
    const vertical = session.splitOrientation === 'vertical';
    const negativeKey = vertical ? 'ArrowLeft' : 'ArrowUp';
    const positiveKey = vertical ? 'ArrowRight' : 'ArrowDown';
    const pairWeight = separatorPairWeight(separatorIndex);
    const current = session.groups[separatorIndex].splitRatio;
    let next: number | undefined;
    if (event.key === negativeKey) next = current - pairWeight * 0.02;
    if (event.key === positiveKey) next = current + pairWeight * 0.02;
    if (event.key === 'Home') next = MIN_GROUP_RATIO;
    if (event.key === 'End') next = pairWeight - MIN_GROUP_RATIO;
    if (next === undefined) return;
    event.preventDefault();
    event.stopPropagation();
    applySession(resizeAdjacentGroups(session, separatorIndex, next));
  }
  function isPreviewPath(path: string) { return /\.(png|jpe?g|gif|webp|pdf)$/i.test(path); }
  async function addPreviewPath(path: string, title?: string) {
    const preview = await invoke<{ path: string; data_url: string; mime: string }>('preview_file', { path });
    applyActivation(addTab(session, createTab({ kind: 'preview', filePath: preview.path, content: preview.data_url, language: 'preview', title: title ?? path.split('/').at(-1), readOnly: true, previewDataUrl: preview.data_url, previewMime: preview.mime })));
  }
  async function rehydratePreviews() {
    const previews = session.tabs.filter((tab) => tab.kind === 'preview' && tab.filePath).map((tab) => ({ id: tab.id, path: tab.filePath as string, title: tab.title }));
    for (const previewTab of previews) {
      try {
        const preview = await invoke<{ path: string; data_url: string; mime: string }>('preview_file', { path: previewTab.path });
        const current = session.tabs.find((tab) => tab.id === previewTab.id);
        if (current?.kind === 'preview' && current.filePath === previewTab.path) applySession(updateTab(session, previewTab.id, { content: preview.data_url, previewDataUrl: preview.data_url, previewMime: preview.mime, readOnly: true }));
      } catch {
        if (session.tabs.some((tab) => tab.id === previewTab.id)) applySession(closeTab(session, previewTab.id, Date.now(), 'closed'));
        showNotice(t('previewRestoreFailed', { name: previewTab.title }));
      }
    }
  }
  async function rehydrateFileBindings() {
    const files = session.tabs.filter((tab) => tab.kind === 'file' && tab.filePath).map((tab) => ({ id: tab.id, path: tab.filePath as string, title: tab.title }));
    for (const file of files) {
      try {
        await invoke('open_text_file', { path: file.path });
      } catch {
        const current = session.tabs.find((tab) => tab.id === file.id);
        if (current?.kind !== 'file' || current.filePath !== file.path) continue;
        applySession(updateTab(session, file.id, { kind: 'temporary', filePath: undefined, encoding: undefined, lineEnding: undefined, dirty: false }));
        showNotice(t('filePathInvalid', { name: file.title }));
      }
    }
  }
  async function openPath(path: string, title?: string) {
    if (isPreviewPath(path)) {
      try { await addPreviewPath(path, title); } catch (error) { window.alert(`${t('unsupportedPreview')}${String(error)}`); }
      return;
    }
    try {
      const opened = await invoke<{ path: string; content: string; language: string; encoding: string; line_ending: '\n' | '\r\n' | '\r' }>('open_text_file', { path });
      applyActivation(addTab(session, createTab({ kind: 'file', filePath: opened.path, content: opened.content, language: opened.language, encoding: opened.encoding, lineEnding: opened.line_ending, title: title ?? path.split('/').at(-1) })));
    } catch (textError) {
      try { await addPreviewPath(path, title); } catch { window.alert(`${t('unsupportedOpen')}${String(textError)}`); }
    }
  }
  async function openTextFile() {
    const path = await open({ multiple: true, directory: false });
    if (!path) return;
    const selectedPaths = Array.isArray(path) ? path : [path];
    for (const selectedPath of selectedPaths) if (selectedPath) await openPath(selectedPath);
  }
  async function openPreviewFile() {
    const path = await open({ multiple: true, directory: false });
    if (!path) return;
    const selectedPaths = Array.isArray(path) ? path : [path];
    for (const selectedPath of selectedPaths) {
      if (!selectedPath) continue;
      try { await addPreviewPath(selectedPath); } catch (error) { window.alert(`${t('unsupportedPreview')}${String(error)}`); }
    }
  }
  function clipboardPath(uri: string): string | undefined {
    try {
      const parsed = new URL(uri.trim());
      if (parsed.protocol !== 'file:' || (parsed.hostname && parsed.hostname !== 'localhost')) return undefined;
      return decodeURIComponent(parsed.pathname);
    } catch {
      return undefined;
    }
  }
  async function openPastedFiles(event: ClipboardEvent) {
    const clipboard = event.clipboardData;
    if (!clipboard) return;
    const paths = new Set<string>();
    for (const file of Array.from(clipboard.files)) {
      const path = Reflect.get(file, 'path');
      if (typeof path === 'string' && path) paths.add(path);
    }
    const uriList = clipboard.getData('text/uri-list');
    for (const line of uriList.split(/\r?\n/)) {
      if (!line || line.startsWith('#')) continue;
      const path = clipboardPath(line);
      if (path) paths.add(path);
    }
    if (paths.size === 0) return;
    event.preventDefault();
    for (const path of paths) await openPath(path);
  }
  async function requestQuit() {
    if (quitInProgress) return;
    quitInProgress = true;
    const result = checkpoint(session);
    if (!result.ok) {
      console.error('Edgedor session checkpoint failed during quit', result.error);
      showNotice(t('quitCheckpointFailed'));
      if (!window.confirm(t('quitWithoutSaveConfirm'))) {
        try { await invoke('cancel_quit_request'); }
        catch (error) { console.error('Edgedor quit cancellation reset failed', error); }
        quitInProgress = false;
        return;
      }
    }
    try {
      await invoke('quit_app');
    } catch (error) {
      quitInProgress = false;
      showNotice(String(error));
    }
  }
  onMount(() => {
    let disposed = false;
    let unlistenDragDrop: (() => void) | undefined;
    const startup = readStartupState(localStorage);
    const saved = startup.session;
    const settings = { ...startup.settings, pinned: false };
    const restoredBase = saved ? { ...saved, settings } : { ...session, settings };
    const expiredOnStartup = expireTabs(restoredBase);
    const restored = saved
      ? expiredOnStartup.state
      : addTab(expiredOnStartup.state, createTab());
    const restoredActiveTabId = restored.groups.find((group) => group.id === restored.activeGroupId)?.activeTabId;
    applySession(restoredActiveTabId ? focusTab(restored, restoredActiveTabId) : restored);
    if (import.meta.env.DEV && new URLSearchParams(window.location.search).has('editor-model-probe')) {
      document.documentElement.dataset.editorModelProbe = 'RUNNING';
      void import('../lib/editor/monacoModel.probe').then(({ runMonacoModelProbe }) => runMonacoModelProbe()).then((result) => {
        document.documentElement.dataset.editorModelProbe = result;
      }).catch((error) => {
        document.documentElement.dataset.editorModelProbe = `FAIL ${String(error)}`;
        console.error(error);
      });
    }
    void rehydratePreviews();
    void rehydrateFileBindings();
    pinned = session.settings.pinned;
    void isAutostartEnabled().then((autostartEnabled) => {
      if (autostartEnabled !== session.settings.launchAtLogin) updateSettings({ ...session.settings, launchAtLogin: autostartEnabled });
    }).catch(() => { /* autostart is unavailable outside a packaged desktop runtime */ });
    void invoke('set_menu_bar_icon_visible', { visible: session.settings.showMenuBarIcon });
    void invoke('set_dock_icon_visible', { visible: session.settings.showDockIcon });
    void invoke('set_panel_pinned', { pinned });
    void invoke('set_edge_modifier', { modifier: session.settings.edgeModifier });
    void setEdgeOptions();
    void invoke('set_panel_animation', { enabled: session.settings.panelAnimationEnabled, durationMs: session.settings.panelAnimationDurationMs });
    expiryTimer = window.setInterval(() => { const result = expireTabs(session); if (result.expired.length) { applySession(result.state); showNotice(t('tabsExpired', { count: result.expired.length })); } }, 60_000);
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 'p') { if (!status.visible) return; event.preventDefault(); openCommands(); return; }
      if (event.key === 'Escape' && showSearch) { event.preventDefault(); closeSearch(); return; }
      if (event.key === 'Escape' && showSettings) { event.preventDefault(); closeSettings(); return; }
      if (event.key === 'Escape' && showCommands) { event.preventDefault(); closeCommands(); return; }
      if (showCommands && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) { event.preventDefault(); commandIndex = (commandIndex + (event.key === 'ArrowDown' ? 1 : filteredCommands.length - 1)) % Math.max(filteredCommands.length, 1); return; }
      if (showCommands && event.key === 'Enter') { event.preventDefault(); const command = filteredCommands[commandIndex]; if (command) runCommand(command); return; }
      if (!status.visible) return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') { event.preventDefault(); void saveActive(); }
      if ((event.metaKey || event.ctrlKey) && (event.key === '+' || event.key === '=')) { event.preventDefault(); changeFontSize(1); }
      if ((event.metaKey || event.ctrlKey) && event.key === '-') { event.preventDefault(); changeFontSize(-1); }
      if ((event.metaKey || event.ctrlKey) && event.key === '0') { event.preventDefault(); updateSettings({ ...session.settings, fontSize: 14 }); }
      if ((event.metaKey || event.ctrlKey) && !event.shiftKey && event.key.toLowerCase() === 'n') { event.preventDefault(); newTab(); }
      if ((event.metaKey || event.ctrlKey) && !event.shiftKey && event.key.toLowerCase() === 'w') { event.preventDefault(); closeActive(); }
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 't') { event.preventDefault(); restoreClosed(); }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'q') { event.preventDefault(); void requestQuit(); }
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 'f') { event.preventDefault(); openSearch(); }
      if ((event.metaKey || event.ctrlKey) && event.key === ',') { event.preventDefault(); openSettings(); }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('paste', openPastedFiles);
    const onWindowBlur = () => { cleanupTabDrag(); if (status.visible) void panelAction(pinned ? 'lower' : 'hide'); };
    const onWindowFocus = () => { if (status.visible) void panelAction('focus'); };
    window.addEventListener('blur', onWindowBlur);
    window.addEventListener('focus', onWindowFocus);
    void getCurrentWebview().onDragDropEvent(async (event) => {
      if (event.payload.type === 'leave') {
        cleanupTabDrag();
        return;
      }
      if (event.payload.type !== 'drop') return;
      cleanupTabDrag();
      for (const path of event.payload.paths) await openPath(path);
    }).then((nextUnlisten) => {
      if (disposed) nextUnlisten();
      else unlistenDragDrop = nextUnlisten;
    }).catch((error) => console.error('Edgedor native drag-drop initialization failed', error));
    void (async () => {
      try {
        unlistenQuit = await listen('quit_requested', () => { void requestQuit(); });
        if (await invoke<boolean>('mark_quit_listener_ready')) void requestQuit();
      } catch (error) {
        console.error('Edgedor quit listener initialization failed', error);
        showNotice(String(error));
      }
      unlisten = await listenPanelStatus((next) => {
        if (panelStatusInitialized && status.visible && !next.visible) checkpoint(session);
        status = next;
        panelStatusInitialized = true;
      });
      unlistenPaths = await listen<string[]>('open_paths', (event) => { for (const path of event.payload) void openPath(path); });
      const initialPaths = await invoke<string[]>('startup_paths');
      for (const path of initialPaths) await openPath(path);
      if (initialPaths.length > 0) await panelAction('show');
    })();
    return () => { disposed = true; cleanupSeparatorDrag(); cleanupTabDrag(); unlistenDragDrop?.(); unlisten?.(); unlistenPaths?.(); unlistenQuit?.(); if (expiryTimer) window.clearInterval(expiryTimer); if (noticeTimer) window.clearTimeout(noticeTimer); window.removeEventListener('keydown', onKeyDown); window.removeEventListener('paste', openPastedFiles); window.removeEventListener('blur', onWindowBlur); window.removeEventListener('focus', onWindowFocus); editorModelRegistry.disposeAll(); };
  });
</script>
<svelte:head><title>{t('appTitle')}</title></svelte:head>
  <main class="shell" class:side-tabs={session.settings.showTabs && session.settings.tabLayout !== 'top'} class:side-tabs-right={session.settings.showTabs && session.settings.tabLayout !== 'top' && (status.triggerEdge ? status.triggerEdge === 'left' : session.settings.tabLayout === 'right')}>
  <ToolbarMount />
  <header class="toolbar" aria-label={t('toolbarAria')}>
    <button onclick={newTab} title={t('newTab')}>＋ {t('new')}</button>
    <button onclick={openTextFile}>{t('openFile')}</button>
    <button onclick={openPreviewFile}>{t('previewFile')}</button>
    <button onclick={saveActive} disabled={!activeTab || activeTab.kind === 'preview'} title={t('saveActiveTitle')}>{t('save')}{activeTab?.dirty ? ' ·' : ''}</button>
    <button onclick={addSplit} title={t('addSplitTitle')}>{t('split')}</button>
    {#if session.groups.length > 1}<button onclick={toggleSplitOrientation} title={t('toggleSplitTitle')}>{session.splitOrientation === 'vertical' ? t('splitHorizontal') : t('splitVertical')}</button>{/if}
    <button onclick={closeSplit} disabled={session.groups.length <= 1} title={t('mergeTitle')}>{t('merge')}</button>
    <span class="toolbar-spacer"></span>
    <button onclick={openSearch} title={t('searchTitle')}>{t('search')}</button>
    <button onclick={openSettings} aria-haspopup="dialog">{t('settings')}</button>
    <button class="pin" aria-pressed={pinned} onclick={togglePinned}>{pinned ? t('unpin') : t('pin')}</button>
  </header>
  {#if session.settings.showTabs}<nav class="tabs" class:compressed-tabs={session.settings.tabLayout === 'top' && session.settings.topTabBehavior === 'compress'} aria-label={t('tabsAria')}>
    {#each session.tabs as tab (tab.id)}
      <div class:active={tab.id === activeTab?.id} class="tab-wrap">
        <button class="tab" draggable="true" ondragstart={(event) => startTabDrag(tab.id, event)} ondragend={cleanupTabDrag} onclick={() => applyActivation(focusTab(session, tab.id))} ondblclick={(event) => { event.stopPropagation(); renameTab(tab.id); }} title={`${tab.filePath ?? tab.title}${t('tabDragHint')}`}>{tab.dirty ? '● ' : ''}{tab.title}{tab.kind === 'preview' ? ` · ${t('previewSuffix')}` : ''}</button>
        <button class="tab-close" aria-label={t('closeTabAria', { name: tab.title })} onclick={(event) => { event.stopPropagation(); closeTabById(tab.id); }}>×</button>
      </div>
    {/each}
    {#if session.tabs.length === 0}<button class="empty-tab" onclick={newTab}>{t('newTab')}</button>{/if}
    <button class="restore" onclick={restoreClosed} disabled={session.undoSlots.length === 0} title={session.undoSlots[0] ? `${session.undoSlots[0].tab.title} · ${session.undoSlots[0].reason === 'expired' ? t('expired') : t('closed')}` : t('noUndo')}>{t('restoreClosed')}{session.undoSlots.length ? ` (${session.undoSlots.length})` : ''}</button>
  </nav>{/if}
  <section bind:this={workspaceElement} class:split-workspace={session.groups.length > 1} class:split-horizontal={session.splitOrientation === 'horizontal'} class="workspace" aria-label={t('workspaceAria')}>
    {#each session.groups as group, index (group.id)}
      {@const tab = groupTab(group)}
      <section class="editor-group" style={groupStyle(group)} aria-label={t('groupAria', { id: group.id })} onpointerdown={() => { if (tab) applyActivation(focusTab(session, tab.id)); }} onfocusin={() => { if (tab) applyActivation(focusTab(session, tab.id)); }} ondragover={dragInternalTabOver} ondrop={(event) => dropTabInGroup(group.id, event)}>
        {#if tab}
          {#if tab.kind === 'preview'}<PreviewSurface dataUrl={tab.previewDataUrl ?? tab.content} mime={tab.previewMime ?? 'application/octet-stream'} onRefresh={() => refreshPreview(tab)} />{:else}<div class="editor-stack">{#if session.settings.showBreadcrumbs}<div class="breadcrumbs" title={tab.filePath ?? tab.title}>{tab.filePath ? tab.filePath.split('/').filter(Boolean).join(' › ') : tab.title}</div>{/if}{#key tab.id}<EditorSurface tab={tab} fontSize={session.settings.fontSize} shortcutProfile={session.settings.shortcutProfile} shortcutOverrides={session.settings.shortcutOverrides} editorVisibility={{ showLineNumbers: session.settings.showLineNumbers, showMinimap: session.settings.showMinimap, showFolding: session.settings.showFolding, showGlyphMargin: session.settings.showGlyphMargin }} onChange={(content) => editContentFor(tab.id, content)} onStateChange={(editor) => editStateFor(tab.id, editor)} />{/key}{#if session.settings.showStatusBar}<div class="editor-status"><span>{tab.encoding?.toUpperCase() ?? 'UTF-8'} · {tab.lineEnding === '\r\n' ? 'CRLF' : tab.lineEnding === '\r' ? 'CR' : 'LF'}</span><label>{t('languageMode')}<select aria-label={t('languageMode')} value={tab.language} onchange={(event) => setLanguage(tab.id, event)}>{#each languageOptions as language}<option value={language}>{language}</option>{/each}</select></label></div>{/if}</div>{/if}
        {:else}<button class="empty" onclick={() => { const next = addTab(session, createTab(), group.id); applyActivation(next); }}>{t('newGroupTab')}</button>{/if}
      </section>
      {#if index < session.groups.length - 1}
        <!-- svelte-ignore a11y_no_noninteractive_tabindex a11y_no_noninteractive_element_interactions -->
        <div
          class="group-separator"
          role="separator"
          tabindex="0"
          aria-label={t('separatorAria', { leading: index + 1, trailing: index + 2 })}
          title={t('separatorKeyboardHint')}
          aria-orientation={session.splitOrientation === 'vertical' ? 'vertical' : 'horizontal'}
          aria-valuemin={Math.round((separatorLeadingOffset(index) + MIN_GROUP_RATIO) * 1000) / 10}
          aria-valuemax={Math.round((separatorLeadingOffset(index) + separatorPairWeight(index) - MIN_GROUP_RATIO) * 1000) / 10}
          aria-valuenow={Math.round(separatorValue(index) * 1000) / 10}
          onpointerdown={(event) => startSeparatorDrag(index, event)}
          onpointermove={resizeFromPointer}
          onpointerup={finishSeparatorDrag}
          onpointercancel={finishSeparatorDrag}
          onlostpointercapture={finishSeparatorDrag}
          onkeydown={(event) => resizeSeparatorFromKeyboard(index, event)}
        ></div>
      {/if}
    {/each}
  </section>
  {#if notice}<div class="notice" role="status">{notice}</div>{/if}
  <footer aria-live="polite">{status.bridgeReady ? t('nativeReady') : t('nativeConnecting')} · {t('tabCount', { count: session.tabs.length })} · {t('undoCount', { count: session.undoSlots.length })}</footer>
  {#if showSearch}
    <div class="search-backdrop" role="presentation" onclick={(event) => { if (event.target === event.currentTarget) closeSearch(); }}>
      <div class="search-panel" role="dialog" aria-modal="true" aria-label={t('crossTabSearch')}>
        <div class="settings-heading"><h2>{t('crossTabSearch')}</h2><button bind:this={searchCloseButton} aria-label={t('closeSearch')} onclick={closeSearch}>×</button></div>
        <input bind:this={searchInput} bind:value={searchQuery} placeholder={t('searchPlaceholder')} aria-label={t('searchInputAria')} />
        <div class="search-results">
          {#if searchQuery.trim() && searchResults().length === 0}<p>{t('noMatches')}</p>{/if}
          {#each searchResults() as result (`${result.tab.id}:${result.index}`)}
            <button class="search-result" onclick={() => focusSearchResult(result.tab.id)}><strong>{result.tab.title}</strong><span>{result.excerpt}</span></button>
          {/each}
        </div>
      </div>
    </div>
  {/if}
  {#if showCommands}
    <div class="command-backdrop" role="presentation" onclick={(event) => { if (event.target === event.currentTarget) closeCommands(); }}>
      <div class="command-panel" role="dialog" aria-modal="true" aria-label={t('commandPanel')}>
        <input bind:this={commandInput} bind:value={commandQuery} placeholder={t('commandPlaceholder')} aria-label={t('commandPlaceholder')} />
        <div class="command-list">
          {#if filteredCommands.length === 0}<p>{t('noCommands')}</p>{/if}
          {#each filteredCommands as command, index (command.id)}<button class:selected={index === commandIndex} onclick={() => runCommand(command)}>{command.label()}</button>{/each}
        </div>
      </div>
    </div>
  {/if}
  {#if showSettings}
    <div class="settings-backdrop" role="presentation" onclick={(event) => { if (event.target === event.currentTarget) closeSettings(); }}>
      <div class="settings-panel" role="dialog" aria-modal="true" aria-label={t('settingsDialog')}>
        <div class="settings-heading"><h2>{t('settings')}</h2><button bind:this={settingsCloseButton} aria-label={t('closeSettings')} onclick={closeSettings}>×</button></div>
        <label>{t('shortcutProfile')}<select aria-label={t('shortcutProfile')} value={session.settings.shortcutProfile} onchange={setShortcutProfile}><option value="vscode">VS Code</option><option value="sublime">Sublime Text</option><option value="jetbrains">JetBrains</option><option value="vim">{t('vimEditor')}</option></select></label>
        <label>{t('edgeModifier')}<select aria-label={t('edgeModifier')} value={session.settings.edgeModifier} onchange={setEdgeModifier}><option value="command">{t('commandKey')}</option><option value="option">{t('optionKey')}</option><option value="control">{t('controlKey')}</option><option value="shift">{t('shiftKey')}</option></select></label>
        <label class="checkbox"><input type="checkbox" checked={session.settings.leftEdgeEnabled} onchange={(event) => updateEdgeOption('leftEdgeEnabled', (event.currentTarget as HTMLInputElement).checked)} />{t('leftEdge')}</label>
        <label class="checkbox"><input type="checkbox" checked={session.settings.rightEdgeEnabled} onchange={(event) => updateEdgeOption('rightEdgeEnabled', (event.currentTarget as HTMLInputElement).checked)} />{t('rightEdge')}</label>
        <label>{t('edgeDwell')}<input type="number" min="50" max="2000" step="10" value={session.settings.edgeDwellMs} onchange={(event) => updateEdgeOption('edgeDwellMs', Math.max(50, Math.min(2000, Number((event.currentTarget as HTMLInputElement).value) || 150)))} /></label>
        <label class="checkbox"><input type="checkbox" checked={session.settings.panelAnimationEnabled} onchange={(event) => void setAnimationOption('panelAnimationEnabled', (event.currentTarget as HTMLInputElement).checked)} />{t('panelAnimation')}</label>
        <label>{t('animationDuration')}<input type="number" min="50" max="1000" step="10" value={session.settings.panelAnimationDurationMs} onchange={(event) => void setAnimationOption('panelAnimationDurationMs', Math.max(50, Math.min(1000, Number((event.currentTarget as HTMLInputElement).value) || 180)))} /></label>
        <label>{t('tabLayout')}<select aria-label={t('tabLayout')} value={session.settings.tabLayout} onchange={setTabLayout}><option value="top">{t('tabTop')}</option><option value="left">{t('tabLeft')}</option><option value="right">{t('tabRight')}</option></select></label>
        {#if session.settings.tabLayout === 'top'}<label>{t('topTabBehavior')}<select aria-label={t('topTabBehavior')} value={session.settings.topTabBehavior} onchange={setTopTabBehavior}><option value="scroll">{t('tabScroll')}</option><option value="compress">{t('tabCompress')}</option></select></label>{/if}
        <fieldset class="shortcut-list"><legend>{t('customShortcuts')}</legend>{#each editorShortcutCommands as shortcut}<label>{shortcut.label}<input aria-label={t('shortcutAria', { name: shortcut.label })} placeholder={t('shortcutPlaceholder')} value={session.settings.shortcutOverrides[shortcut.id] ?? ''} onchange={(event) => setShortcutOverride(shortcut.id, event)} /></label>{/each}</fieldset>
        <label>{t('fontSize')} <span class="font-controls"><button onclick={() => changeFontSize(-1)}>−</button><output>{session.settings.fontSize}px</output><button onclick={() => changeFontSize(1)}>＋</button></span></label>
        <fieldset class="shortcut-list"><legend>{t('editorRegion')}</legend>
          <label class="checkbox"><input type="checkbox" checked={session.settings.showLineNumbers} onchange={(event) => setEditorVisibility('showLineNumbers', event)} />{t('lineNumbers')}</label>
          <label class="checkbox"><input type="checkbox" checked={session.settings.showMinimap} onchange={(event) => setEditorVisibility('showMinimap', event)} />{t('minimap')}</label>
          <label class="checkbox"><input type="checkbox" checked={session.settings.showFolding} onchange={(event) => setEditorVisibility('showFolding', event)} />{t('folding')}</label>
          <label class="checkbox"><input type="checkbox" checked={session.settings.showGlyphMargin} onchange={(event) => setEditorVisibility('showGlyphMargin', event)} />{t('glyphMargin')}</label>
          <label class="checkbox"><input type="checkbox" checked={session.settings.showTabs} onchange={(event) => setDisplayVisibility('showTabs', event)} />{t('tabBar')}</label>
          <label class="checkbox"><input type="checkbox" checked={session.settings.showBreadcrumbs} onchange={(event) => setDisplayVisibility('showBreadcrumbs', event)} />{t('breadcrumbs')}</label>
          <label class="checkbox"><input type="checkbox" checked={session.settings.showStatusBar} onchange={(event) => setDisplayVisibility('showStatusBar', event)} />{t('statusBar')}</label>
        </fieldset>
        <label class="checkbox"><input type="checkbox" checked={session.settings.preserveOnRestart} onchange={setPreserveOnRestart} />{t('preserveRestart')}</label>
        <label class="checkbox"><input type="checkbox" checked={session.settings.showMenuBarIcon} onchange={setMenuBarIcon} />{t('showMenuBar')}</label>
        <label class="checkbox"><input type="checkbox" checked={session.settings.showDockIcon} onchange={setDockIcon} />{t('showDock')}</label>
        <label class="checkbox"><input type="checkbox" checked={session.settings.launchAtLogin} onchange={setLaunchAtLogin} />{t('launchAtLogin')}</label>
        <button onclick={checkForUpdates}>{t('checkUpdates')}</button>
        <p class="settings-note">{t('allTabsExpiryNote')}</p>
        <button class="danger" onclick={clearWorkspace}>{t('clearWorkspace')}</button>
        <button class="danger" onclick={resetSettings}>{t('resetSettings')}</button>
        <button class="done" onclick={closeSettings}>{t('done')}</button>
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
  .tabs.compressed-tabs { overflow-x: hidden; }
  .tabs.compressed-tabs .tab-wrap { min-width: 42px; flex: 1 1 0; overflow: hidden; }
  .tabs.compressed-tabs .tab { min-width: 0; flex: 1; overflow: hidden; text-overflow: ellipsis; }
  .tab-wrap.active { background: color-mix(in srgb, var(--text) 12%, transparent); }
  .tab, .tab-close { border: 0; background: transparent; color: var(--muted); white-space: nowrap; }
  .tab { padding: 5px 3px 5px 9px; }
  .tab-close { padding: 4px 6px 4px 2px; border-radius: 5px; }
  .pin { align-self: flex-end; margin: -4px 12px 6px; border: 0; border-radius: 6px; padding: 4px 8px; color: var(--muted); background: transparent; font-size: 11px; }
  .tabs .restore { margin-left: auto; font-size: 11px; }
  .empty-tab { border: 0; border-radius: 7px; padding: 5px 9px; color: var(--muted); background: transparent; }
  .workspace { min-height: 0; flex: 1; display: flex; }
  .split-workspace { background: color-mix(in srgb, var(--text) 12%, transparent); }
  .split-workspace.split-horizontal { flex-direction: column; }
  .editor-group { min-width: 0; min-height: 0; flex-shrink: 1; display: flex; background: var(--panel); }
  .group-separator { position: relative; z-index: 1; flex: 0 0 6px; padding: 0; border: 0; cursor: col-resize; touch-action: none; outline: none; background: var(--panel); }
  .group-separator::after { content: ''; position: absolute; inset: 0 2.5px; background: color-mix(in srgb, var(--text) 14%, transparent); transition: background .12s ease, inset .12s ease; }
  .group-separator:hover::after, .group-separator:focus-visible::after { inset-inline: 2px; background: color-mix(in srgb, var(--text) 42%, transparent); }
  .split-horizontal > .group-separator { cursor: row-resize; }
  .split-horizontal > .group-separator::after { inset: 2.5px 0; }
  .split-horizontal > .group-separator:hover::after, .split-horizontal > .group-separator:focus-visible::after { inset-block: 2px; }
  .editor-stack { min-width: 0; min-height: 0; flex: 1; display: flex; flex-direction: column; }
  .breadcrumbs { flex: 0 0 auto; overflow: hidden; padding: 4px 10px; color: var(--muted); border-bottom: 1px solid color-mix(in srgb, var(--text) 8%, transparent); font: 11px/16px ui-monospace, monospace; text-overflow: ellipsis; white-space: nowrap; }
  .editor-status { flex: 0 0 auto; display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 24px; padding: 2px 8px; color: var(--muted); border-top: 1px solid color-mix(in srgb, var(--text) 8%, transparent); font: 11px/16px ui-monospace, monospace; }
  .editor-status label { display: flex; align-items: center; gap: 6px; }
  .editor-status select { max-width: 128px; border: 0; color: var(--muted); background: transparent; font: inherit; }
  .empty { margin: auto; border: 0; border-radius: 8px; padding: 10px 14px; }
  .notice { position: absolute; left: 50%; bottom: 34px; transform: translateX(-50%); max-width: calc(100% - 24px); padding: 7px 12px; border-radius: 9px; color: var(--text); background: color-mix(in srgb, var(--panel) 88%, var(--text)); box-shadow: 0 5px 25px rgba(0,0,0,.18); font-size: 12px; }
  footer { padding: 6px 16px 10px; font-size: 11px; color: var(--muted); }
  .settings-backdrop { position: fixed; inset: 0; z-index: 10; display: flex; justify-content: flex-end; background: rgba(0,0,0,.16); }
  .search-backdrop { position: fixed; inset: 0; z-index: 11; display: grid; place-items: start center; padding-top: 12vh; background: rgba(0,0,0,.16); }
  .command-backdrop { position: fixed; inset: 0; z-index: 12; display: grid; place-items: start center; padding-top: 10vh; background: rgba(0,0,0,.16); }
  .command-panel { width: min(560px, 90vw); max-height: 60vh; padding: 10px; display: flex; flex-direction: column; gap: 8px; color: var(--text); background: var(--panel); border-radius: 10px; box-shadow: 0 16px 45px rgba(0,0,0,.25); }
  .command-panel > input { border: 1px solid color-mix(in srgb, var(--text) 15%, transparent); border-radius: 7px; padding: 9px; color: var(--text); background: color-mix(in srgb, var(--text) 5%, transparent); }
  .command-list { display: flex; flex-direction: column; overflow: auto; gap: 3px; }
  .command-list button { border: 0; border-radius: 6px; padding: 8px 10px; text-align: left; color: var(--text); background: transparent; }
  .command-list button:hover { background: color-mix(in srgb, var(--text) 12%, transparent); }
  .command-list button.selected { background: color-mix(in srgb, var(--text) 12%, transparent); }
  .command-list p { margin: 8px; color: var(--muted); font-size: 12px; }
  .search-panel { width: min(620px, 90vw); max-height: 70vh; padding: 16px; display: flex; flex-direction: column; gap: 12px; color: var(--text); background: var(--panel); border-radius: 12px; box-shadow: 0 16px 45px rgba(0,0,0,.25); }
  .search-panel > input { border: 1px solid color-mix(in srgb, var(--text) 15%, transparent); border-radius: 7px; padding: 9px; color: var(--text); background: color-mix(in srgb, var(--text) 5%, transparent); }
  .search-results { min-height: 0; overflow: auto; display: flex; flex-direction: column; gap: 5px; }
  .search-results p { margin: 8px 0; color: var(--muted); font-size: 12px; }
  .search-result { display: flex; flex-direction: column; align-items: flex-start; gap: 3px; border: 0; border-radius: 7px; padding: 8px; text-align: left; color: var(--text); background: color-mix(in srgb, var(--text) 5%, transparent); }
  .search-result span { color: var(--muted); font: 11px/1.4 ui-monospace, monospace; }
  .settings-panel { width: min(360px, 90vw); height: 100%; padding: 20px; display: flex; flex-direction: column; gap: 16px; overflow-y: auto; color: var(--text); background: var(--panel); box-shadow: -10px 0 30px rgba(0,0,0,.15); }
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
