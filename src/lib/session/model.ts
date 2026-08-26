export const SESSION_VERSION = 1;
export const TAB_EXPIRY_MS = 24 * 60 * 60 * 1000;
export const MAX_UNDO_SLOTS = 10;
export const MAX_EDITOR_GROUPS = 4;
export const MIN_GROUP_RATIO = 0.1;

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
  languageManuallySelected?: boolean;
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
  splitRatio: number;
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
  showTabs: boolean;
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
  splitOrientation: SplitOrientation;
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
  showTabs: true,
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
  const group: EditorGroup = { id: 'group-1', splitRatio: 1, tabIds: [], activeTabId: undefined };
  return {
    version: SESSION_VERSION,
    tabs: [],
    groups: [group],
    activeGroupId: group.id,
    splitOrientation: 'vertical',
    undoSlots: [],
    settings: { ...DEFAULT_SESSION_SETTINGS, shortcutOverrides: { ...DEFAULT_SESSION_SETTINGS.shortcutOverrides } }
  };
}

function normalizeGroupRatios(groups: EditorGroup[]): EditorGroup[] {
  if (groups.length === 0) return groups;
  const rawRatios = groups.map((group) => Number.isFinite(group.splitRatio) && group.splitRatio > 0 ? group.splitRatio : MIN_GROUP_RATIO);
  const excess = rawRatios.map((ratio) => Math.max(0, ratio - MIN_GROUP_RATIO));
  const available = 1 - groups.length * MIN_GROUP_RATIO;
  const excessTotal = excess.reduce((sum, ratio) => sum + ratio, 0);
  const ratios = excessTotal > 0
    ? excess.map((ratio) => MIN_GROUP_RATIO + available * ratio / excessTotal)
    : groups.map(() => 1 / groups.length);
  const correction = 1 - ratios.reduce((sum, ratio) => sum + ratio, 0);
  ratios[ratios.length - 1] += correction;
  return groups.map((group, index) => ({ ...group, splitRatio: ratios[index] }));
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

export function createGroup(state: SessionState, orientation: SplitOrientation = state.splitOrientation, _splitRatio = 0.5, id = newId()): SessionState {
  if (state.groups.length >= MAX_EDITOR_GROUPS) return state;
  const activeIndex = state.groups.findIndex((group) => group.id === state.activeGroupId);
  if (activeIndex < 0) return state;
  const groupId = state.groups.some((group) => group.id === id) ? newId() : id;
  const groups = normalizeGroupRatios(state.groups);
  const activeRatio = groups[activeIndex].splitRatio;
  const nextGroups = groups.map((group, index) => index === activeIndex ? { ...group, splitRatio: activeRatio / 2 } : group);
  nextGroups.splice(activeIndex + 1, 0, { id: groupId, splitRatio: activeRatio / 2, tabIds: [], activeTabId: undefined });
  return {
    ...state,
    groups: normalizeGroupRatios(nextGroups),
    activeGroupId: groupId,
    splitOrientation: orientation
  };
}

export function removeGroup(state: SessionState, groupId: string): SessionState {
  if (state.groups.length <= 1) return state;
  const groupIndex = state.groups.findIndex((candidate) => candidate.id === groupId);
  if (groupIndex < 0) return state;
  const groups = normalizeGroupRatios(state.groups);
  const group = groups[groupIndex];
  const receiverIndex = groupIndex < groups.length - 1 ? groupIndex + 1 : groupIndex - 1;
  const receiver = groups[receiverIndex];
  const removingActiveGroup = state.activeGroupId === groupId;
  const movedTabs = state.tabs.map((tab) => tab.groupId === groupId ? { ...tab, groupId: receiver.id } : tab);
  const mergedTabIds = [...receiver.tabIds, ...group.tabIds.filter((tabId) => !receiver.tabIds.includes(tabId))];
  const removedActiveTabId = group.activeTabId && group.tabIds.includes(group.activeTabId) ? group.activeTabId : undefined;
  const receiverActiveTabId = removingActiveGroup
    ? removedActiveTabId ?? (receiver.activeTabId && mergedTabIds.includes(receiver.activeTabId) ? receiver.activeTabId : mergedTabIds.at(-1))
    : receiver.activeTabId;
  const remainingGroups = groups
    .filter((candidate) => candidate.id !== groupId)
    .map((candidate) => candidate.id === receiver.id
      ? { ...candidate, splitRatio: candidate.splitRatio + group.splitRatio, tabIds: mergedTabIds, activeTabId: receiverActiveTabId }
      : candidate);
  return {
    ...state,
    tabs: movedTabs,
    groups: normalizeGroupRatios(remainingGroups),
    activeGroupId: removingActiveGroup ? receiver.id : state.activeGroupId
  };
}

export function setGroupRatio(state: SessionState, groupId: string, splitRatio: number): SessionState {
  const groupIndex = state.groups.findIndex((group) => group.id === groupId);
  if (groupIndex < 0 || state.groups.length < 2) return state;
  const separatorIndex = groupIndex === state.groups.length - 1 ? groupIndex - 1 : groupIndex;
  return resizeAdjacentGroups(state, separatorIndex, groupIndex === separatorIndex ? splitRatio : (state.groups[separatorIndex].splitRatio + state.groups[groupIndex].splitRatio - splitRatio));
}

export function resizeAdjacentGroups(state: SessionState, separatorIndex: number, leadingWeight: number): SessionState {
  if (!Number.isInteger(separatorIndex) || separatorIndex < 0 || separatorIndex >= state.groups.length - 1 || !Number.isFinite(leadingWeight)) return state;
  const groups = normalizeGroupRatios(state.groups);
  const pairWeight = groups[separatorIndex].splitRatio + groups[separatorIndex + 1].splitRatio;
  if (pairWeight < MIN_GROUP_RATIO * 2) return state;
  const nextLeading = Math.max(MIN_GROUP_RATIO, Math.min(pairWeight - MIN_GROUP_RATIO, leadingWeight));
  return {
    ...state,
    groups: groups.map((group, index) => {
      if (index === separatorIndex) return { ...group, splitRatio: nextLeading };
      if (index === separatorIndex + 1) return { ...group, splitRatio: pairWeight - nextLeading };
      return group;
    })
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
  const groups = normalizeGroupRatios(state.groups).map((group) => ({
    id: group.id,
    splitRatio: group.splitRatio,
    tabIds: group.tabIds,
    activeTabId: group.activeTabId
  }));
  return JSON.stringify({ ...state, tabs, groups, undoSlots: [], version: SESSION_VERSION });
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
    showTabs: input.showTabs ?? DEFAULT_SESSION_SETTINGS.showTabs,
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
    const parsed = JSON.parse(serialized) as Record<string, unknown>;
    if (parsed?.version !== SESSION_VERSION || !Array.isArray(parsed.tabs) || !Array.isArray(parsed.groups)) return undefined;

    const seenTabIds = new Set<string>();
    const tabs = parsed.tabs.filter((tab): tab is SessionTab => {
      if (!tab || typeof tab !== 'object') return false;
      const id = (tab as Partial<SessionTab>).id;
      if (typeof id !== 'string' || !id || seenTabIds.has(id)) return false;
      seenTabIds.add(id);
      return true;
    });
    type LegacyGroup = Partial<EditorGroup> & { parentId?: string; orientation?: SplitOrientation };
    const rawGroups = parsed.groups.filter((group): group is LegacyGroup => Boolean(group && typeof group === 'object'));
    const keptRawGroups = rawGroups.slice(0, MAX_EDITOR_GROUPS);
    if (keptRawGroups.length === 0) keptRawGroups.push({ id: 'group-1', tabIds: [] });

    const usedGroupIds = new Set<string>();
    const groups: EditorGroup[] = keptRawGroups.map((group, index) => {
      let id = typeof group.id === 'string' && group.id && !usedGroupIds.has(group.id) ? group.id : `group-${index + 1}`;
      while (usedGroupIds.has(id)) id = `${id}-${index + 1}`;
      usedGroupIds.add(id);
      return { id, splitRatio: Number(group.splitRatio), tabIds: [], activeTabId: undefined };
    });

    const tabById = new Map(tabs.map((tab) => [tab.id, tab]));
    const assignedTabIds = new Set<string>();
    const appendTabIds = (target: EditorGroup, tabIds: unknown) => {
      if (!Array.isArray(tabIds)) return;
      for (const tabId of tabIds) {
        if (typeof tabId !== 'string' || !tabById.has(tabId) || assignedTabIds.has(tabId)) continue;
        target.tabIds.push(tabId);
        assignedTabIds.add(tabId);
      }
    };
    keptRawGroups.forEach((group, index) => appendTabIds(groups[index], group.tabIds));
    if (rawGroups.length > MAX_EDITOR_GROUPS) {
      const lastGroup = groups[MAX_EDITOR_GROUPS - 1];
      for (const overflowGroup of rawGroups.slice(MAX_EDITOR_GROUPS)) appendTabIds(lastGroup, overflowGroup.tabIds);
    }

    const groupByRawId = new Map<string, EditorGroup>();
    keptRawGroups.forEach((group, index) => {
      if (typeof group.id === 'string') groupByRawId.set(group.id, groups[index]);
    });
    const overflowTarget = rawGroups.length > MAX_EDITOR_GROUPS ? groups[MAX_EDITOR_GROUPS - 1] : undefined;
    for (const tab of tabs) {
      if (assignedTabIds.has(tab.id)) continue;
      const target = overflowTarget ?? groupByRawId.get(tab.groupId) ?? groups[0];
      target.tabIds.push(tab.id);
      assignedTabIds.add(tab.id);
    }

    const finalGroupByTabId = new Map<string, EditorGroup>();
    for (const group of groups) for (const tabId of group.tabIds) finalGroupByTabId.set(tabId, group);
    const repairedTabs = tabs.map((tab) => ({ ...tab, groupId: finalGroupByTabId.get(tab.id)?.id ?? groups[0].id }));

    const originalActiveGroupId = typeof parsed.activeGroupId === 'string' ? parsed.activeGroupId : '';
    const originalActiveGroup = rawGroups.find((group) => group.id === originalActiveGroupId);
    const originalActiveTabId = typeof originalActiveGroup?.activeTabId === 'string' ? originalActiveGroup.activeTabId : undefined;
    groups.forEach((group, index) => {
      const rawActiveTabId = typeof keptRawGroups[index]?.activeTabId === 'string' ? keptRawGroups[index].activeTabId : undefined;
      group.activeTabId = rawActiveTabId && group.tabIds.includes(rawActiveTabId) ? rawActiveTabId : group.tabIds.at(-1);
    });

    const hasNewRatios = keptRawGroups.every((group) => Number.isFinite(group.splitRatio) && Number(group.splitRatio) > 0);
    const legacyRatio = keptRawGroups.length === 2
      && !(Number.isFinite(keptRawGroups[0].splitRatio) && Number(keptRawGroups[0].splitRatio) > 0)
      && Number.isFinite(keptRawGroups[1].splitRatio)
      ? Number(keptRawGroups[1].splitRatio)
      : undefined;
    const ratioGroups = groups.map((group, index) => ({
      ...group,
      splitRatio: hasNewRatios
        ? Number(keptRawGroups[index].splitRatio)
        : legacyRatio !== undefined
          ? (index === 0 ? 1 - legacyRatio : legacyRatio)
          : 1
    }));
    const normalizedGroups = normalizeGroupRatios(ratioGroups);

    const splitOrientation: SplitOrientation = parsed.splitOrientation === 'horizontal' || parsed.splitOrientation === 'vertical'
      ? parsed.splitOrientation
      : rawGroups.find((group) => group.orientation === 'horizontal' || group.orientation === 'vertical')?.orientation ?? 'vertical';
    let activeGroup = normalizedGroups.find((group) => group.id === originalActiveGroupId);
    if (!activeGroup && originalActiveTabId) activeGroup = normalizedGroups.find((group) => group.tabIds.includes(originalActiveTabId));
    activeGroup ??= normalizedGroups.find((group) => group.tabIds.length > 0) ?? normalizedGroups[0];
    if (originalActiveTabId && activeGroup.tabIds.includes(originalActiveTabId)) activeGroup.activeTabId = originalActiveTabId;
    if (!activeGroup.activeTabId || !activeGroup.tabIds.includes(activeGroup.activeTabId)) activeGroup.activeTabId = activeGroup.tabIds.at(-1);

    return {
      version: SESSION_VERSION,
      tabs: repairedTabs,
      groups: normalizedGroups,
      activeGroupId: activeGroup.id,
      splitOrientation,
      undoSlots: [],
      settings: normalizeSettings((parsed.settings && typeof parsed.settings === 'object' ? parsed.settings : {}) as Partial<SessionSettings>)
    };
  } catch {
    return undefined;
  }
}
