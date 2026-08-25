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
    settings: { preserveOnRestart: true, shortcutProfile: 'vscode', shortcutOverrides: {}, fontSize: 14, showMenuBarIcon: true }
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
    .sort((first, second) => second.lastFocusedAt - first.lastFocusedAt);
  return expired.reduce((result, tab) => ({ state: closeTab(result.state, tab.id, now, 'expired'), expired: [...result.expired, tab] }), { state, expired: [] } as ExpiryResult);
}

export function restoreLatest(state: SessionState): SessionState {
  const slot = state.undoSlots[0];
  if (!slot) return state;
  const group = state.groups.find((candidate) => candidate.id === slot.tab.groupId) ?? state.groups[0];
  if (!group || state.tabs.some((tab) => tab.id === slot.tab.id)) return state;
  return {
    ...addTab(state, slot.tab, group.id),
    undoSlots: state.undoSlots.slice(1)
  };
}

export function pruneExpired(state: SessionState, now = Date.now()): SessionState {
  return expireTabs(state, now).state;
}

export function serializeSession(state: SessionState): string {
  return JSON.stringify({ ...state, version: SESSION_VERSION });
}

export function deserializeSession(serialized: string): SessionState | undefined {
  try {
    const parsed = JSON.parse(serialized) as SessionState;
    if (parsed?.version !== SESSION_VERSION || !Array.isArray(parsed.tabs) || !Array.isArray(parsed.groups)) return undefined;
    parsed.settings = { preserveOnRestart: parsed.settings?.preserveOnRestart ?? true, shortcutProfile: parsed.settings?.shortcutProfile ?? 'vscode', shortcutOverrides: parsed.settings?.shortcutOverrides ?? {}, fontSize: parsed.settings?.fontSize ?? 14, showMenuBarIcon: parsed.settings?.showMenuBarIcon ?? true };
    return parsed;
  } catch {
    return undefined;
  }
}
