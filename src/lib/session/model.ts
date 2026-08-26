export const SESSION_VERSION = 1;
export const TAB_EXPIRY_MS = 24 * 60 * 60 * 1000;
export const MAX_UNDO_SLOTS = 10;

export type TabKind = 'temporary' | 'file' | 'preview';
export type SplitOrientation = 'horizontal' | 'vertical';
export type CloseReason = 'closed' | 'expired';

export interface EditorSnapshot {
  selections?: unknown;
  scrollTop?: number;
  scrollLeft?: number;
  viewState?: unknown;
}

export interface SessionTab {
  id: string;
  kind: TabKind;
  title: string;
  content: string;
  language: string;
  groupId: string;
  filePath?: string;
  encoding?: string;
  lineEnding?: '\n' | '\r\n' | '\r';
  readOnly: boolean;
  dirty?: boolean;
  previewDataUrl?: string;
  previewMime?: string;
  manuallyNamed: boolean;
  createdAt: number;
  updatedAt: number;
  lastFocusedAt: number;
  editor: EditorSnapshot;
}

export interface EditorGroup {
  id: string;
  parentId?: string;
  orientation?: SplitOrientation;
  splitRatio?: number;
  tabIds: string[];
  activeTabId?: string;
}

export interface UndoSlot {
  tab: SessionTab;
  closedAt: number;
  reason: CloseReason;
}

export interface SessionSettings {
  preserveOnRestart: boolean;
  launchAtLogin: boolean;
  shortcutProfile: 'vscode' | 'sublime' | 'jetbrains' | 'vim';
  shortcutOverrides: Record<string, string>;
  fontSize: number;
  showLineNumbers: boolean;
  showMinimap: boolean;
  showFolding: boolean;
  showGlyphMargin: boolean;
  showMenuBarIcon: boolean;
  showDockIcon: boolean;
  edgeModifier: 'command' | 'option' | 'control' | 'shift';
  leftEdgeEnabled: boolean;
  rightEdgeEnabled: boolean;
  edgeDwellMs: number;
  panelAnimationEnabled: boolean;
  panelAnimationDurationMs: number;
  tabLayout: 'top' | 'left' | 'right';
  topTabBehavior: 'scroll' | 'compress';
  showBreadcrumbs: boolean;
  showStatusBar: boolean;
  pinned: boolean;
}

export interface SessionState {
  version: number;
  tabs: SessionTab[];
  groups: EditorGroup[];
  activeGroupId: string;
  undoSlots: UndoSlot[];
  settings: SessionSettings;
}

export const DEFAULT_SESSION_SETTINGS: SessionSettings = {
  preserveOnRestart: true,
  launchAtLogin: false,
  shortcutProfile: 'vscode',
  shortcutOverrides: {},
  fontSize: 14,
  showLineNumbers: true,
  showMinimap: true,
  showFolding: true,
  showGlyphMargin: false,
  showMenuBarIcon: true,
  showDockIcon: false,
  edgeModifier: 'command',
  leftEdgeEnabled: true,
  rightEdgeEnabled: true,
  edgeDwellMs: 150,
  panelAnimationEnabled: true,
  panelAnimationDurationMs: 180,
  tabLayout: 'top',
  topTabBehavior: 'scroll',
  showBreadcrumbs: true,
  showStatusBar: true,
  pinned: false
};

export interface NewTabInput {
  kind?: TabKind;
  content?: string;
  language?: string;
  title?: string;
  groupId?: string;
  filePath?: string;
  encoding?: string;
  lineEnding?: SessionTab['lineEnding'];
  readOnly?: boolean;
  dirty?: boolean;
  previewDataUrl?: string;
  previewMime?: string;
  now?: number;
  id?: string;
}

const fallbackId = () => `tab-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export function newId(): string {
  return globalThis.crypto?.randomUUID?.() ?? fallbackId();
}

export function deriveTitle(content: string, language = 'plaintext'): string {
  const firstLine = content.split(/\r\n|\r|\n/, 1)[0]?.trim() ?? '';
  if (firstLine) return firstLine.slice(0, 80);
  return language === 'plaintext' ? 'Untitled' : `Untitled · ${language}`;
}

export function createTab(input: NewTabInput = {}): SessionTab {
  const now = input.now ?? Date.now();
  const kind = input.kind ?? 'temporary';
  const language = input.language ?? 'plaintext';
  const content = input.content ?? '';
  return {
    id: input.id ?? newId(),
    kind,
    title: input.title ?? deriveTitle(content, language),
    content,
    language,
    groupId: input.groupId ?? 'group-1',
    filePath: input.filePath,
    encoding: input.encoding,
    lineEnding: input.lineEnding,
    readOnly: input.readOnly ?? kind === 'preview',
    dirty: input.dirty ?? false,
    previewDataUrl: input.previewDataUrl,
    previewMime: input.previewMime,
    manuallyNamed: input.title !== undefined,
    createdAt: now,
    updatedAt: now,
    lastFocusedAt: now,
    editor: {}
  };
}

export function createSessionState(now = Date.now()): SessionState {
  const group: EditorGroup = { id: 'group-1', tabIds: [], activeTabId: undefined };
  return {
    version: SESSION_VERSION,
    tabs: [],
    groups: [group],
    activeGroupId: group.id,
    undoSlots: [],
    settings: { ...DEFAULT_SESSION_SETTINGS, shortcutOverrides: { ...DEFAULT_SESSION_SETTINGS.shortcutOverrides } }
  };
}

export function addTab(state: SessionState, tab: SessionTab, groupId = state.activeGroupId): SessionState {
  const targetGroup = state.groups.find((group) => group.id === groupId) ?? state.groups[0];
  if (!targetGroup) return state;
  const placedTab = { ...tab, groupId: targetGroup.id };
  return {
    ...state,
    tabs: [...state.tabs, placedTab],
    groups: state.groups.map((group) => group.id === targetGroup.id
      ? { ...group, tabIds: [...group.tabIds, placedTab.id], activeTabId: placedTab.id }
      : group),
    activeGroupId: targetGroup.id
  };
}

export function createGroup(state: SessionState, orientation: SplitOrientation = 'vertical', splitRatio = 0.5, id = newId()): SessionState {
  const parentId = state.activeGroupId;
  const clampedRatio = Math.max(0.2, Math.min(0.8, splitRatio));
  const group: EditorGroup = { id, parentId, orientation, splitRatio: clampedRatio, tabIds: [], activeTabId: undefined };
  return { ...state, groups: [...state.groups, group], activeGroupId: group.id };
}

export function removeGroup(state: SessionState, groupId: string): SessionState {
  if (state.groups.length <= 1) return state;
  const group = state.groups.find((candidate) => candidate.id === groupId);
  if (!group) return state;
  const fallback = state.groups.find((candidate) => candidate.id !== groupId);
  if (!fallback) return state;
  const movedTabs = state.tabs.map((tab) => tab.groupId === groupId ? { ...tab, groupId: fallback.id } : tab);
  return {
    ...state,
    tabs: movedTabs,
    groups: state.groups.filter((candidate) => candidate.id !== groupId).map((candidate) => candidate.id === fallback.id
      ? { ...candidate, tabIds: [...candidate.tabIds, ...group.tabIds], activeTabId: candidate.activeTabId ?? group.activeTabId }
      : candidate),
    activeGroupId: state.activeGroupId === groupId ? fallback.id : state.activeGroupId
  };
}

export function setGroupRatio(state: SessionState, groupId: string, splitRatio: number): SessionState {
  const clampedRatio = Math.max(0.2, Math.min(0.8, splitRatio));
  return { ...state, groups: state.groups.map((group) => group.id === groupId ? { ...group, splitRatio: clampedRatio } : group) };
}

export function focusTab(state: SessionState, tabId: string, now = Date.now()): SessionState {
  const tab = state.tabs.find((candidate) => candidate.id === tabId);
  if (!tab) return state;
  return {
    ...state,
    tabs: state.tabs.map((candidate) => candidate.id === tabId
      ? { ...candidate, lastFocusedAt: now, updatedAt: Math.max(candidate.updatedAt, now) }
      : candidate),
    groups: state.groups.map((group) => group.id === tab.groupId ? { ...group, activeTabId: tabId } : group),
    activeGroupId: tab.groupId
  };
}

export function touchTab(state: SessionState, tabId: string, now = Date.now()): SessionState {
  if (!state.tabs.some((tab) => tab.id === tabId)) return state;
  return {
    ...state,
    tabs: state.tabs.map((tab) => tab.id === tabId
      ? { ...tab, lastFocusedAt: now, updatedAt: Math.max(tab.updatedAt, now) }
      : tab)
  };
}

export function moveTabToGroup(state: SessionState, tabId: string, targetGroupId: string, now = Date.now()): SessionState {
  const tab = state.tabs.find((candidate) => candidate.id === tabId);
  const target = state.groups.find((group) => group.id === targetGroupId);
  if (!tab || !target) return state;
  if (tab.groupId === targetGroupId) return focusTab(state, tabId, now);
  const source = state.groups.find((group) => group.id === tab.groupId);
  const nextGroups = state.groups.map((group) => {
    if (group.id === source?.id) {
      const tabIds = group.tabIds.filter((id) => id !== tabId);
      return { ...group, tabIds, activeTabId: group.activeTabId === tabId ? tabIds.at(-1) : group.activeTabId };
    }
    if (group.id === targetGroupId) return { ...group, tabIds: [...group.tabIds, tabId], activeTabId: tabId };
    return group;
  });
  return {
    ...state,
    tabs: state.tabs.map((candidate) => candidate.id === tabId ? { ...candidate, groupId: targetGroupId, lastFocusedAt: now, updatedAt: Math.max(candidate.updatedAt, now) } : candidate),
    groups: nextGroups,
    activeGroupId: targetGroupId
  };
}

export function updateTab(state: SessionState, tabId: string, patch: Partial<SessionTab>, now = Date.now()): SessionState {
  return {
    ...state,
    tabs: state.tabs.map((tab) => {
      if (tab.id !== tabId) return tab;
      const next = { ...tab, ...patch, updatedAt: now };
      if (patch.content !== undefined && tab.kind === 'file' && patch.dirty === undefined) next.dirty = patch.content !== tab.content;
      if (!next.manuallyNamed && (patch.content !== undefined || patch.language !== undefined)) {
        next.title = deriveTitle(next.content, next.language);
      }
      return next;
    })
  };
}

function pushUndoSlot(state: SessionState, tab: SessionTab, closedAt: number, reason: CloseReason): UndoSlot[] {
  return [{ tab, closedAt, reason }, ...state.undoSlots].slice(0, MAX_UNDO_SLOTS);
}

export function closeTab(state: SessionState, tabId: string, now = Date.now(), reason: CloseReason = 'closed'): SessionState {
  const tab = state.tabs.find((candidate) => candidate.id === tabId);
  if (!tab) return state;
  const remainingTabs = state.tabs.filter((candidate) => candidate.id !== tabId);
  const groups = state.groups.map((group) => {
    if (group.id !== tab.groupId) return group;
    const tabIds = group.tabIds.filter((id) => id !== tabId);
    return { ...group, tabIds, activeTabId: group.activeTabId === tabId ? tabIds.at(-1) : group.activeTabId };
  });
  return { ...state, tabs: remainingTabs, groups, undoSlots: pushUndoSlot(state, tab, now, reason) };
}

export interface ExpiryResult { state: SessionState; expired: SessionTab[]; }

export function expireTabs(state: SessionState, now = Date.now()): ExpiryResult {
  const expired = state.tabs
    .filter((tab) => now - tab.lastFocusedAt >= TAB_EXPIRY_MS)
    .sort((first, second) => first.lastFocusedAt - second.lastFocusedAt);
  return expired.reduce((result, tab) => ({ state: closeTab(result.state, tab.id, now, 'expired'), expired: [...result.expired, tab] }), { state, expired: [] } as ExpiryResult);
}

export function restoreLatest(state: SessionState): SessionState {
  const slot = state.undoSlots[0];
  if (!slot) return state;
  const group = state.groups.find((candidate) => candidate.id === slot.tab.groupId) ?? state.groups[0];
  if (!group || state.tabs.some((tab) => tab.id === slot.tab.id)) return state;
  const now = Date.now();
  const restoredTab = { ...slot.tab, groupId: group.id, lastFocusedAt: now, updatedAt: now };
  return focusTab({
    ...addTab(state, restoredTab, group.id),
    undoSlots: state.undoSlots.slice(1)
  }, restoredTab.id, now);
}

export function pruneExpired(state: SessionState, now = Date.now()): SessionState {
  return expireTabs(state, now).state;
}

export function serializeSession(state: SessionState): string {
  const tabs = state.tabs.map((tab) => tab.kind === 'preview'
    ? { ...tab, content: '', previewDataUrl: undefined }
    : tab);
  return JSON.stringify({ ...state, tabs, undoSlots: [], version: SESSION_VERSION });
}

export function serializeSettings(settings: SessionSettings): string {
  return JSON.stringify(settings);
}

export function deserializeSettings(serialized: string): SessionSettings | undefined {
  try {
    const parsed = JSON.parse(serialized) as Partial<SessionSettings>;
    if (!parsed || typeof parsed !== 'object') return undefined;
    return normalizeSettings(parsed);
  } catch {
    return undefined;
  }
}

function normalizeSettings(input: Partial<SessionSettings>): SessionSettings {
  return {
    preserveOnRestart: input.preserveOnRestart ?? DEFAULT_SESSION_SETTINGS.preserveOnRestart,
    launchAtLogin: input.launchAtLogin ?? DEFAULT_SESSION_SETTINGS.launchAtLogin,
    shortcutProfile: input.shortcutProfile ?? DEFAULT_SESSION_SETTINGS.shortcutProfile,
    shortcutOverrides: input.shortcutOverrides ?? {},
    fontSize: input.fontSize ?? DEFAULT_SESSION_SETTINGS.fontSize,
    showLineNumbers: input.showLineNumbers ?? DEFAULT_SESSION_SETTINGS.showLineNumbers,
    showMinimap: input.showMinimap ?? DEFAULT_SESSION_SETTINGS.showMinimap,
    showFolding: input.showFolding ?? DEFAULT_SESSION_SETTINGS.showFolding,
    showGlyphMargin: input.showGlyphMargin ?? DEFAULT_SESSION_SETTINGS.showGlyphMargin,
    showMenuBarIcon: input.showMenuBarIcon ?? DEFAULT_SESSION_SETTINGS.showMenuBarIcon,
    showDockIcon: input.showDockIcon ?? DEFAULT_SESSION_SETTINGS.showDockIcon,
    edgeModifier: input.edgeModifier ?? DEFAULT_SESSION_SETTINGS.edgeModifier,
    leftEdgeEnabled: input.leftEdgeEnabled ?? DEFAULT_SESSION_SETTINGS.leftEdgeEnabled,
    rightEdgeEnabled: input.rightEdgeEnabled ?? DEFAULT_SESSION_SETTINGS.rightEdgeEnabled,
    edgeDwellMs: Math.max(50, Math.min(2000, input.edgeDwellMs ?? DEFAULT_SESSION_SETTINGS.edgeDwellMs)),
    panelAnimationEnabled: input.panelAnimationEnabled ?? DEFAULT_SESSION_SETTINGS.panelAnimationEnabled,
    panelAnimationDurationMs: Math.max(50, Math.min(1000, input.panelAnimationDurationMs ?? DEFAULT_SESSION_SETTINGS.panelAnimationDurationMs)),
    tabLayout: input.tabLayout ?? DEFAULT_SESSION_SETTINGS.tabLayout,
    topTabBehavior: input.topTabBehavior ?? DEFAULT_SESSION_SETTINGS.topTabBehavior,
    showBreadcrumbs: input.showBreadcrumbs ?? DEFAULT_SESSION_SETTINGS.showBreadcrumbs,
    showStatusBar: input.showStatusBar ?? DEFAULT_SESSION_SETTINGS.showStatusBar,
    pinned: input.pinned ?? DEFAULT_SESSION_SETTINGS.pinned
  };
}

export function deserializeSession(serialized: string): SessionState | undefined {
  try {
    const parsed = JSON.parse(serialized) as SessionState;
    if (parsed?.version !== SESSION_VERSION || !Array.isArray(parsed.tabs) || !Array.isArray(parsed.groups)) return undefined;
    parsed.settings = normalizeSettings(parsed.settings ?? {});
    parsed.undoSlots = [];
    return parsed;
  } catch {
    return undefined;
  }
}
