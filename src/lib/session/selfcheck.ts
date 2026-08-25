import {
  MAX_UNDO_SLOTS,
  TAB_EXPIRY_MS,
  addTab,
  closeTab,
  createSessionState,
  createTab,
  deserializeSession,
  expireTabs,
  focusTab,
  restoreLatest,
  serializeSession
} from './model.ts';

const assert = (condition: unknown, message: string) => {
  if (!condition) throw new Error(`session self-check failed: ${message}`);
};

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
assert(withFile.state.tabs.some((candidate) => candidate.id === fileTab.id), 'keeps file tabs out of temporary expiry');
const previewTab = createTab({ id: 'preview-1', kind: 'preview', filePath: '/tmp/example.pdf', content: 'data:application/pdf;base64,very-large-data', previewDataUrl: 'data:application/pdf;base64,very-large-data', now: start });
const serializedPreview = JSON.parse(serializeSession(addTab(state, previewTab))) as { tabs: Array<{ id: string; content: string; previewDataUrl?: string }> };
const persistedPreview = serializedPreview.tabs.find((candidate) => candidate.id === previewTab.id);
assert(persistedPreview?.content === '' && persistedPreview.previewDataUrl === undefined, 'does not persist preview payload');
for (let index = 0; index < MAX_UNDO_SLOTS + 2; index += 1) {
  const extraTab = createTab({ id: `extra-${index}`, now: start });
  state = addTab(state, extraTab);
  state = closeTab(state, extraTab.id, start + index + 1);
}
assert(state.undoSlots.length === MAX_UNDO_SLOTS, 'caps undo slots');
const restored = deserializeSession(serializeSession(state));
assert(restored?.tabs.length === state.tabs.length, 'round-trips serialized state');
console.log('Edgedor session self-check passed');
