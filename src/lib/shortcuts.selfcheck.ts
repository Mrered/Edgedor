import { resolveShortcut, shortcutOverridesFingerprint, shortcutProfiles } from './shortcuts.ts';

const assert = (condition: unknown, message: string) => {
  if (!condition) throw new Error(`shortcut self-check failed: ${message}`);
};

const firstOrder = { deleteLine: 'Cmd+Shift+Backspace', toggleComment: 'Cmd+Alt+/' };
const secondOrder = { toggleComment: 'Cmd+Alt+/', deleteLine: 'Cmd+Shift+Backspace' };
assert(shortcutOverridesFingerprint(firstOrder) === shortcutOverridesFingerprint(secondOrder), 'fingerprint ignores object key order');

const changed = { ...firstOrder, deleteLine: 'Cmd+Shift+Delete' };
assert(shortcutOverridesFingerprint(firstOrder) !== shortcutOverridesFingerprint(changed), 'fingerprint changes when a binding changes');

const removed = { toggleComment: 'Cmd+Alt+/' };
assert(shortcutOverridesFingerprint(firstOrder) !== shortcutOverridesFingerprint(removed), 'fingerprint changes when an override is removed');

const vimDefaults = JSON.stringify(shortcutProfiles.vim);
assert(resolveShortcut('vim', 'deleteLine', { deleteLine: 'Cmd+Shift+Backspace' }) === 'Cmd+Shift+Backspace', 'Vim resolves a custom Monaco override');
assert(JSON.stringify(shortcutProfiles.vim) === vimDefaults && shortcutProfiles.vim.deleteLine === 'dd', 'Vim default sequences remain unchanged');

console.log('Edgedor shortcut self-check passed');
