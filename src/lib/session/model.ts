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
  shortcutProfile: 'vscode' | 'sublime' | 'jetbrains' | 'vim';
  shortcutOverrides: Record<string, string>;
  fontSize: number;
  showMenuBarIcon: boolean;
  edgeModifier: 'command' | 'option' | 'control' | 'shift';
  tabLayout: 'top' | 'left' | 'right';
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
    settings: { preserveOnRestart: true, shortcutProfile: 'vscode', shortcutOverrides: {}, fontSize: 14, showMenuBarIcon: true, edgeModifier: 'command', tabLayout: 'top', pinned: false }
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
    .filter((tab) => tab.kind === 'temporary' && now - tab.lastFocusedAt >= TAB_EXPIRY_MS)
    .sort((first, second) => second.lastFocusedAt - first.lastFocusedAt);
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
  return JSON.stringify({ ...state, tabs, version: SESSION_VERSION });
}

export function deserializeSession(serialized: string): SessionState | undefined {
  try {
    const parsed = JSON.parse(serialized) as SessionState;
    if (parsed?.version !== SESSION_VERSION || !Array.isArray(parsed.tabs) || !Array.isArray(parsed.groups)) return undefined;
    parsed.settings = { preserveOnRestart: parsed.settings?.preserveOnRestart ?? true, shortcutProfile: parsed.settings?.shortcutProfile ?? 'vscode', shortcutOverrides: parsed.settings?.shortcutOverrides ?? {}, fontSize: parsed.settings?.fontSize ?? 14, showMenuBarIcon: parsed.settings?.showMenuBarIcon ?? true, edgeModifier: parsed.settings?.edgeModifier ?? 'command', tabLayout: parsed.settings?.tabLayout ?? 'top', pinned: parsed.settings?.pinned ?? false };
    return parsed;
  } catch {
    return undefined;
  }
}
