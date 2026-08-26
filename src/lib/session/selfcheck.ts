import {
  MAX_EDITOR_GROUPS,
  MIN_GROUP_RATIO,
  MAX_UNDO_SLOTS,
  TAB_EXPIRY_MS,
  addTab,
  closeTab,
  createGroup,
  createSessionState,
  createTab,
  deserializeSession,
  expireTabs,
  focusTab,
  moveTabToGroup,
  removeGroup,
  resizeAdjacentGroups,
  restoreLatest,
  serializeSettings,
  deserializeSettings,
  serializeSession,
  touchTab
} from './model.ts';
import {
  SESSION_KEY,
  SETTINGS_KEY,
  clearSessionCheckpoint,
  persistSessionSettings,
  readStartupState,
  writeSessionCheckpoint,
  type SessionStorage
} from './storage.ts';

const assert = (condition: unknown, message: string) => {
  if (!condition) throw new Error(`session self-check failed: ${message}`);
};

const assertRatios = (state: ReturnType<typeof createSessionState>, message: string) => {
  const ratios = state.groups.map((group) => group.splitRatio ?? Number.NaN);
  assert(ratios.every((ratio) => Number.isFinite(ratio) && ratio >= MIN_GROUP_RATIO - 1e-9), `${message}: ratios stay finite and above minimum`);
  assert(Math.abs(ratios.reduce((sum, ratio) => sum + ratio, 0) - 1) < 1e-9, `${message}: ratios sum to one`);
};

class MemoryStorage implements SessionStorage {
  readonly values = new Map<string, string>();
  readonly operations: Array<{ type: 'get' | 'set' | 'remove'; key: string; value?: string }> = [];

  getItem(key: string): string | null {
    this.operations.push({ type: 'get', key });
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
    this.operations.push({ type: 'set', key, value });
  }

  removeItem(key: string): void {
    this.values.delete(key);
    this.operations.push({ type: 'remove', key });
  }
}

const start = 1_700_000_000_000;
let state = createSessionState(start);
const tab = createTab({ id: 'temporary-1', content: 'const answer = 42', language: 'typescript', now: start });
state = addTab(state, tab);
assert(state.tabs.length === 1 && state.groups[0]?.activeTabId === tab.id, 'adds and activates tab');
state = focusTab(state, tab.id, start + 1_000);
assert(state.tabs[0]?.lastFocusedAt === start + 1_000, 'focus updates lastFocusedAt');
const expired = expireTabs(state, start + 1_000 + TAB_EXPIRY_MS);
assert(expired.expired.length === 1 && expired.state.tabs.length === 0, 'expires inactive tab');
assert(expired.state.undoSlots.length === 1 && expired.state.undoSlots[0]?.reason === 'expired', 'pushes expired tab into undo slot');
state = restoreLatest(expired.state);
assert(state.tabs.length === 1 && state.undoSlots.length === 0, 'restores latest undo slot');
assert((state.tabs[0]?.lastFocusedAt ?? 0) > start + TAB_EXPIRY_MS, 'refreshes restored tab lifetime');
const fileTab = createTab({ id: 'file-1', kind: 'file', filePath: '/tmp/example.ts', now: start });
state = addTab(state, fileTab);
const withFile = expireTabs(state, start + TAB_EXPIRY_MS + 1);
assert(!withFile.state.tabs.some((candidate) => candidate.id === fileTab.id), 'expires inactive file tabs');
const previewTab = createTab({ id: 'preview-1', kind: 'preview', filePath: '/tmp/example.pdf', content: 'data:application/pdf;base64,very-large-data', previewDataUrl: 'data:application/pdf;base64,very-large-data', now: start });
const expiredPreview = expireTabs(addTab(createSessionState(start), previewTab), start + TAB_EXPIRY_MS);
assert(expiredPreview.expired[0]?.id === previewTab.id, 'expires inactive preview tabs');
const serializedPreview = JSON.parse(serializeSession(addTab(state, previewTab))) as { tabs: Array<{ id: string; content: string; previewDataUrl?: string }> };
const persistedPreview = serializedPreview.tabs.find((candidate) => candidate.id === previewTab.id);
assert(persistedPreview?.content === '' && persistedPreview.previewDataUrl === undefined, 'does not persist preview payload');
const splitState = createGroup(state);
const targetGroupId = splitState.groups[1]?.id ?? 'missing';
const movedState = moveTabToGroup(splitState, tab.id, targetGroupId, start + 2_000);
assert(movedState.tabs.find((candidate) => candidate.id === tab.id)?.groupId === targetGroupId, 'moves tab between groups');

let fourGroups = createSessionState(start);
fourGroups = createGroup(fourGroups, 'vertical', 0.5, 'group-2');
fourGroups = createGroup(fourGroups, 'vertical', 0.5, 'group-3');
fourGroups = createGroup(fourGroups, 'vertical', 0.5, 'group-4');
assert(fourGroups.groups.length === MAX_EDITOR_GROUPS, 'creates four editor groups');
assert(fourGroups.groups.map((group) => group.id).join(',') === 'group-1,group-2,group-3,group-4', 'inserts each new group after the active group');
assert(fourGroups.activeGroupId === 'group-4', 'activates the newly created group');
assertRatios(fourGroups, 'four-group creation');
const rejectedFifth = createGroup(fourGroups, 'vertical', 0.5, 'group-5');
assert(rejectedFifth === fourGroups, 'rejects a fifth editor group without changing state');

const beforeResize = fourGroups.groups.map((group) => group.splitRatio ?? 0);
const resizedGroups = resizeAdjacentGroups(fourGroups, 1, 0.18);
const afterResize = resizedGroups.groups.map((group) => group.splitRatio ?? 0);
assert(Math.abs(afterResize[0] - beforeResize[0]) < 1e-9 && Math.abs(afterResize[3] - beforeResize[3]) < 1e-9, 'adjacent resize leaves non-adjacent groups unchanged');
assert(Math.abs((afterResize[1] + afterResize[2]) - (beforeResize[1] + beforeResize[2])) < 1e-9, 'adjacent resize preserves pair weight');
assertRatios(resizedGroups, 'adjacent resize');

let activeRemoval = createSessionState(start);
activeRemoval = addTab(activeRemoval, createTab({ id: 'left-tab', groupId: 'group-1', now: start }));
activeRemoval = createGroup(activeRemoval, 'vertical', 0.5, 'group-2');
activeRemoval = addTab(activeRemoval, createTab({ id: 'middle-tab', groupId: 'group-2', now: start }), 'group-2');
activeRemoval = createGroup(activeRemoval, 'vertical', 0.5, 'group-3');
activeRemoval = addTab(activeRemoval, createTab({ id: 'right-tab', groupId: 'group-3', now: start }), 'group-3');
activeRemoval = focusTab(activeRemoval, 'middle-tab', start + 1);
const removedActive = removeGroup(activeRemoval, 'group-2');
assert(removedActive.activeGroupId === 'group-3', 'active middle group transfers activity to its right visual neighbor');
assert(removedActive.groups.find((group) => group.id === 'group-3')?.activeTabId === 'middle-tab', 'active removed tab remains active in receiving group');
assert(removedActive.tabs.find((candidate) => candidate.id === 'middle-tab')?.groupId === 'group-3', 'active removed tabs move to receiving group');
assertRatios(removedActive, 'active group removal');

const nonActiveRemoval = focusTab(activeRemoval, 'left-tab', start + 2);
const preservedActive = removeGroup(nonActiveRemoval, 'group-2');
assert(preservedActive.activeGroupId === 'group-1', 'removing inactive group preserves active group');
assert(preservedActive.groups.find((group) => group.id === 'group-1')?.activeTabId === 'left-tab', 'removing inactive group preserves active tab');
const removedLast = removeGroup(focusTab(activeRemoval, 'right-tab', start + 3), 'group-3');
assert(removedLast.activeGroupId === 'group-2', 'active last group transfers activity to its left visual neighbor');
assert(removedLast.groups.find((group) => group.id === 'group-2')?.activeTabId === 'right-tab', 'last-group active tab remains active in left receiver');
assert(removedLast.tabs.find((candidate) => candidate.id === 'right-tab')?.groupId === 'group-2', 'last-group tabs move to left receiver');
assertRatios(removedLast, 'last group removal');

const legacyTabA = createTab({ id: 'legacy-a', groupId: 'group-1', now: start });
const legacyTabB = createTab({ id: 'legacy-b', groupId: 'group-2', now: start });
const legacy = deserializeSession(JSON.stringify({
  ...createSessionState(start),
  tabs: [legacyTabA, legacyTabB],
  groups: [
    { id: 'group-1', tabIds: ['legacy-a'], activeTabId: 'legacy-a' },
    { id: 'group-2', parentId: 'group-1', orientation: 'horizontal', splitRatio: 0.3, tabIds: ['legacy-b'], activeTabId: 'legacy-b' }
  ],
  activeGroupId: 'group-2',
  splitOrientation: undefined
}));
assert(legacy?.splitOrientation === 'horizontal', 'migrates legacy split orientation');
assert(Math.abs((legacy?.groups[0]?.splitRatio ?? 0) - 0.7) < 1e-9 && Math.abs((legacy?.groups[1]?.splitRatio ?? 0) - 0.3) < 1e-9, 'migrates legacy child ratio to flat weights');
assert(legacy?.groups.every((group) => !('parentId' in group) && !('orientation' in group)), 'removes legacy group split fields');

const orphanA = createTab({ id: 'orphan-a', groupId: 'missing-a', now: start });
const orphanB = createTab({ id: 'orphan-b', groupId: 'missing-b', now: start });
const repairedEmpty = deserializeSession(JSON.stringify({
  ...createSessionState(start),
  tabs: [orphanA, orphanB],
  groups: [],
  activeGroupId: 'missing'
}));
assert(repairedEmpty?.groups.length === 1 && repairedEmpty.groups[0]?.tabIds.join(',') === 'orphan-a,orphan-b', 'repairs zero-group snapshot in tab order');
assert(repairedEmpty?.tabs.every((candidate) => candidate.groupId === repairedEmpty.groups[0]?.id), 'repairs orphan tab group references');
assert(repairedEmpty?.activeGroupId === repairedEmpty?.groups[0]?.id && repairedEmpty?.groups[0]?.activeTabId === 'orphan-b', 'repairs invalid active references');
if (repairedEmpty) assertRatios(repairedEmpty, 'zero-group repair');

const overflowTabs = Array.from({ length: 7 }, (_, index) => createTab({ id: `overflow-${index + 1}`, groupId: `group-${index + 1}`, now: start + index }));
const repairedOverflow = deserializeSession(JSON.stringify({
  ...createSessionState(start),
  tabs: overflowTabs,
  groups: Array.from({ length: 6 }, (_, index) => ({ id: `group-${index + 1}`, splitRatio: index === 1 ? Number.NaN : 1, tabIds: [`overflow-${index + 1}`], activeTabId: index === 5 ? 'overflow-6' : `missing-${index + 1}` })),
  activeGroupId: 'group-6',
  splitOrientation: 'invalid'
}));
assert(repairedOverflow?.groups.length === MAX_EDITOR_GROUPS, 'truncates snapshots above four groups');
assert(repairedOverflow?.groups[3]?.tabIds.join(',') === 'overflow-4,overflow-5,overflow-6,overflow-7', 'merges truncated and unregistered tabs into fourth group deterministically');
assert(repairedOverflow?.tabs.slice(3).every((candidate) => candidate.groupId === repairedOverflow.groups[3]?.id), 'rewrites merged tab group references');
assert(repairedOverflow?.splitOrientation === 'vertical', 'repairs invalid shared orientation');
assert(repairedOverflow?.activeGroupId === 'group-4' && repairedOverflow.groups[3]?.activeTabId === 'overflow-6', 'repairs invalid active group and tab deterministically');
if (repairedOverflow) assertRatios(repairedOverflow, 'overflow repair');

const persistedFourGroups = addTab(fourGroups, createTab({ id: 'four-group-session', groupId: fourGroups.activeGroupId, now: start }), fourGroups.activeGroupId);
const restoredGroups = deserializeSession(serializeSession(persistedFourGroups));
assert(restoredGroups?.groups.map((group) => group.id).join(',') === fourGroups.groups.map((group) => group.id).join(','), 'round-trips flat group order');
assert(restoredGroups?.activeGroupId === fourGroups.activeGroupId && restoredGroups?.splitOrientation === fourGroups.splitOrientation, 'round-trips active group and shared orientation');
if (restoredGroups) assertRatios(restoredGroups, 'serialized group restoration');
for (let index = 0; index < MAX_UNDO_SLOTS + 2; index += 1) {
  const extraTab = createTab({ id: `extra-${index}`, now: start });
  state = addTab(state, extraTab);
  state = closeTab(state, extraTab.id, start + index + 1);
}
assert(state.undoSlots.length === MAX_UNDO_SLOTS, 'caps undo slots');
const restored = deserializeSession(serializeSession(state));
assert(restored?.tabs.length === state.tabs.length, 'round-trips serialized state');
assert(restored?.undoSlots.length === 0, 'does not restore undo slots across restart');
const settingsRoundTrip = deserializeSettings(serializeSettings(createSessionState().settings));
assert(settingsRoundTrip?.preserveOnRestart === true && settingsRoundTrip?.shortcutProfile === 'vscode', 'round-trips settings independently');
const hostileSettings = deserializeSettings(JSON.stringify({
  preserveOnRestart: 'false',
  launchAtLogin: 1,
  shortcutProfile: 'emacs',
  shortcutOverrides: { deleteLine: 'Cmd+Shift+K', toggleComment: 'D', unknownCommand: 'Cmd+U' },
  fontSize: 999,
  showLineNumbers: 'true',
  showMinimap: false,
  showFolding: null,
  showGlyphMargin: true,
  showTabs: 0,
  showMenuBarIcon: false,
  showDockIcon: 'yes',
  edgeModifier: 'fn',
  leftEdgeEnabled: false,
  rightEdgeEnabled: 'false',
  edgeDwellMs: 9_999,
  panelAnimationEnabled: 1,
  panelAnimationDurationMs: -1,
  tabLayout: 'bottom',
  topTabBehavior: 'wrap',
  showBreadcrumbs: false,
  showStatusBar: 'false',
  pinned: true
}));
assert(hostileSettings?.preserveOnRestart === true && hostileSettings.launchAtLogin === false, 'rejects non-boolean settings');
assert(hostileSettings?.shortcutProfile === 'vscode' && hostileSettings.edgeModifier === 'command', 'rejects invalid setting enums');
assert(hostileSettings?.tabLayout === 'top' && hostileSettings.topTabBehavior === 'scroll', 'repairs invalid tab enums');
assert(hostileSettings?.fontSize === 32 && hostileSettings.edgeDwellMs === 2_000 && hostileSettings.panelAnimationDurationMs === 50, 'clamps finite numeric settings');
assert(hostileSettings?.showMinimap === false && hostileSettings.showGlyphMargin === true && hostileSettings.leftEdgeEnabled === false, 'preserves valid booleans');
assert(hostileSettings?.shortcutOverrides.deleteLine === 'Cmd+Shift+K' && Object.keys(hostileSettings.shortcutOverrides).length === 1, 'filters shortcut overrides by command and binding');
assert(Object.getPrototypeOf(hostileSettings?.shortcutOverrides) === Object.prototype, 'rebuilds shortcut overrides as a plain object');
assert(deserializeSettings('[]') === undefined && deserializeSettings('{') === undefined, 'rejects array and truncated settings JSON');

const validRecoveredTab = {
  ...createTab({ id: 'valid-recovered', content: 'safe', now: start }),
  languageManuallySelected: true,
  encoding: 'utf-16le',
  lineEnding: '\r\n',
  editor: { scrollTop: 12, scrollLeft: 3, selections: { cursor: 1 }, viewState: { top: 2 }, ignored: true },
  unexpected: 'discard me'
};
const partiallyCorrupt = deserializeSession(JSON.stringify({
  ...createSessionState(start),
  tabs: [
    validRecoveredTab,
    { ...createTab({ id: 'valid-recovered', now: start }), content: 'duplicate' },
    { ...createTab({ id: 'missing-time', now: start }), updatedAt: 'now' },
    { ...createTab({ id: 'bad-kind', now: start }), kind: 'remote' },
    { ...createTab({ id: 'missing-file', kind: 'file', now: start }), filePath: '' },
    { ...createTab({ id: 'missing-preview', kind: 'preview', now: start }), filePath: undefined },
    { ...createTab({ id: 'invalid-editor', now: start }), editor: [], dirty: 'yes', languageManuallySelected: 1 }
  ],
  groups: [
    { id: 'group-1', splitRatio: 0.75, tabIds: ['valid-recovered', 'missing-time'], activeTabId: 'missing-time' },
    { id: 'group-1', splitRatio: Number.POSITIVE_INFINITY, tabIds: ['invalid-editor'], activeTabId: 'invalid-editor' },
    null
  ],
  activeGroupId: 'missing',
  splitOrientation: 'diagonal'
}));
assert(partiallyCorrupt?.tabs.map((candidate) => candidate.id).join(',') === 'valid-recovered,invalid-editor', 'drops unrecoverable and duplicate tabs while preserving valid tabs');
const recoveredValid = partiallyCorrupt?.tabs.find((candidate) => candidate.id === 'valid-recovered');
assert(recoveredValid?.encoding === 'utf-16le' && recoveredValid.lineEnding === '\r\n' && recoveredValid.languageManuallySelected === true, 'preserves validated optional tab metadata');
assert(!('unexpected' in (recoveredValid ?? {})) && !('ignored' in (recoveredValid?.editor ?? {})), 'rebuilds tabs and editor snapshots without unknown fields');
const recoveredInvalidEditor = partiallyCorrupt?.tabs.find((candidate) => candidate.id === 'invalid-editor');
assert(Object.keys(recoveredInvalidEditor?.editor ?? {}).length === 0 && recoveredInvalidEditor?.dirty === undefined && recoveredInvalidEditor?.languageManuallySelected === undefined, 'clears invalid optional tab and editor fields');
assert(partiallyCorrupt?.groups.length === 2 && new Set(partiallyCorrupt.groups.map((group) => group.id)).size === 2, 'repairs duplicate group ids and removes invalid groups');
assert(partiallyCorrupt?.groups.flatMap((group) => group.tabIds).join(',') === 'valid-recovered,invalid-editor', 'repairs group membership from validated tabs');
assert(partiallyCorrupt?.activeGroupId === partiallyCorrupt?.groups[0]?.id && partiallyCorrupt?.splitOrientation === 'vertical', 'repairs invalid active group and orientation');
assert(deserializeSession('') === undefined && deserializeSession('{}') === undefined && deserializeSession('[]') === undefined, 'rejects empty, malformed, and non-object session roots');
assert(deserializeSession(JSON.stringify({ ...createSessionState(start), version: 2 })) === undefined, 'rejects unknown session versions');
assert(deserializeSession(JSON.stringify({ ...createSessionState(start), tabs: [] })) === undefined, 'rejects snapshots without recoverable tabs');
assert(deserializeSession(JSON.stringify({ ...createSessionState(start), tabs: [null, { id: '' }] })) === undefined, 'rejects snapshots whose tabs are entirely corrupt');
const expiredAtStartup = expireTabs(addTab(createSessionState(start), createTab({ id: 'old', now: start })), start + TAB_EXPIRY_MS);
assert(expiredAtStartup.expired.length === 1 && expiredAtStartup.state.undoSlots[0]?.tab.id === 'old', 'expires temporary tabs during startup recovery');
let batchExpiry = createSessionState(start);
for (let index = 0; index < 12; index += 1) batchExpiry = addTab(batchExpiry, createTab({ id: `stale-${index}`, now: start + index }));
const batchResult = expireTabs(batchExpiry, start + TAB_EXPIRY_MS + 12);
assert(batchResult.state.undoSlots.length === MAX_UNDO_SLOTS && batchResult.state.undoSlots[0]?.tab.id === 'stale-11', 'keeps newest expired tabs in undo slots');
const touched = touchTab(addTab(createSessionState(start), createTab({ id: 'touch-me', now: start })), 'touch-me', start + 4_000);
assert(touched.tabs[0]?.lastFocusedAt === start + 4_000, 'touch refreshes tab lifetime without changing group focus');

const storage = new MemoryStorage();
const preservingState = addTab(createSessionState(start), previewTab);
persistSessionSettings(storage, preservingState.settings);
assert(storage.operations.length === 1 && storage.operations[0]?.key === SETTINGS_KEY, 'ordinary settings persistence never writes session');
assert(!storage.operations.some((operation) => operation.type === 'set' && operation.key === SESSION_KEY), 'enabling recovery does not write session');
writeSessionCheckpoint(storage, preservingState);
const sessionWrite = storage.operations.find((operation) => operation.type === 'set' && operation.key === SESSION_KEY);
assert(Boolean(sessionWrite?.value), 'enabled recovery checkpoint writes session');
const checkpoint = JSON.parse(sessionWrite?.value ?? '{}') as { version?: number; tabs?: Array<{ content?: string; previewDataUrl?: string }> };
assert(checkpoint.version === preservingState.version, 'checkpoint includes session version');
assert(checkpoint.tabs?.[0]?.content === '' && checkpoint.tabs[0]?.previewDataUrl === undefined, 'checkpoint strips preview payload');

const disabledState = { ...preservingState, settings: { ...preservingState.settings, preserveOnRestart: false } };
persistSessionSettings(storage, disabledState.settings);
const disableOperations = storage.operations.slice(-2);
assert(disableOperations[0]?.type === 'set' && disableOperations[0].key === SETTINGS_KEY, 'disabling recovery persists settings');
assert(disableOperations[1]?.type === 'remove' && disableOperations[1].key === SESSION_KEY, 'disabling recovery immediately removes session');
const beforeDisabledCheckpoint = storage.operations.length;
writeSessionCheckpoint(storage, disabledState);
const disabledCheckpointOperations = storage.operations.slice(beforeDisabledCheckpoint);
assert(disabledCheckpointOperations.length === 1 && disabledCheckpointOperations[0]?.type === 'remove', 'disabled checkpoint only removes session');
assert(!disabledCheckpointOperations.some((operation) => operation.type === 'set' && operation.key === SESSION_KEY), 'disabled checkpoint never writes session');

storage.setItem(SESSION_KEY, 'stale');
clearSessionCheckpoint(storage);
assert(storage.operations.at(-1)?.type === 'remove' && storage.operations.at(-1)?.key === SESSION_KEY, 'explicit clear removes snapshot');

const disabledStartup = new MemoryStorage();
disabledStartup.values.set(SETTINGS_KEY, serializeSettings({ ...createSessionState(start).settings, preserveOnRestart: false }));
disabledStartup.values.set(SESSION_KEY, serializeSession(addTab(createSessionState(start), createTab({ id: 'must-not-read', now: start }))));
const disabledStartupState = readStartupState(disabledStartup);
assert(disabledStartupState.session === undefined && disabledStartupState.settings.preserveOnRestart === false, 'disabled startup never adopts a prior session');
assert(disabledStartup.operations.some((operation) => operation.type === 'remove' && operation.key === SESSION_KEY), 'disabled startup clears the session checkpoint');
assert(!disabledStartup.operations.some((operation) => operation.type === 'get' && operation.key === SESSION_KEY), 'disabled startup never reads the session checkpoint');

const corruptStartup = new MemoryStorage();
corruptStartup.values.set(SETTINGS_KEY, serializeSettings(createSessionState(start).settings));
corruptStartup.values.set(SESSION_KEY, '{broken');
const corruptStartupState = readStartupState(corruptStartup);
assert(corruptStartupState.session === undefined, 'corrupt startup snapshot is not adopted');
assert(corruptStartup.operations.at(-1)?.type === 'remove' && corruptStartup.operations.at(-1)?.key === SESSION_KEY, 'corrupt startup snapshot is cleared');

const migratedStartup = new MemoryStorage();
const migratedSession = addTab(createSessionState(start), createTab({ id: 'legacy-session', now: start }));
migratedSession.settings = { ...migratedSession.settings, preserveOnRestart: false, fontSize: 22 };
migratedStartup.values.set(SESSION_KEY, serializeSession(migratedSession));
const migratedStartupState = readStartupState(migratedStartup);
assert(migratedStartupState.session?.tabs[0]?.id === 'legacy-session', 'missing independent settings may migrate a valid legacy session');
assert(migratedStartupState.settings.fontSize === 22 && migratedStartupState.settings.preserveOnRestart === true, 'legacy settings migration adopts settings but defaults recovery to enabled');
console.log('Edgedor session self-check passed');
