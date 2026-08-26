import {
  SHORTCUT_KEYS,
  SHORTCUT_KEY_CODE_NAMES,
  parseShortcut,
  resolveShortcut,
  shortcutOverridesFingerprint,
  shortcutProfiles,
  validateShortcut
} from './shortcuts.ts';

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

for (const key of SHORTCUT_KEYS) {
  const parsed = parseShortcut(`Cmd+${key}`);
  assert(parsed?.key === key, `parses supported key ${key}`);
  assert(Object.prototype.hasOwnProperty.call(SHORTCUT_KEY_CODE_NAMES, parsed?.key ?? ''), `supported key ${key} has a Monaco registration target`);
  assert(validateShortcut(`Cmd+${key}`) === parsed?.normalized, `validation and parsing agree for ${key}`);
}

const punctuationAliases: Record<string, string> = {
  '/': 'Slash', ';': 'Semicolon', '=': 'Equal', ',': 'Comma', '-': 'Minus', '.': 'Period',
  '`': 'Backquote', '[': 'BracketLeft', '\\': 'Backslash', ']': 'BracketRight', "'": 'Quote'
};
for (const [alias, key] of Object.entries(punctuationAliases)) {
  assert(parseShortcut(`Cmd+${alias}`)?.key === key, `normalizes punctuation alias ${alias}`);
}

assert(parseShortcut(' command + option + d ')?.normalized === 'Cmd+Alt+D', 'normalizes modifier aliases and spacing');
assert(parseShortcut('Cmd+Command+D') === undefined && parseShortcut('Ctrl+Control+D') === undefined, 'rejects duplicate semantic modifiers');
for (const binding of ['D', '7', 'F2', 'Up', 'Delete', 'Cmd+', 'Cmd+Hyper+D', 'Cmd+F25', 'Cmd+Unknown']) {
  assert(validateShortcut(binding) === undefined, `rejects unsupported binding ${binding}`);
}
for (const sequence of ['g*', ':%s', 'ddP', 'ddp', 'dd', 'gcc']) {
  assert(parseShortcut(sequence) === undefined, `keeps Vim sequence ${sequence} outside Monaco overrides`);
}

console.log('Edgedor shortcut self-check passed');
