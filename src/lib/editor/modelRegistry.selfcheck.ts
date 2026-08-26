import { TabModelRegistry, type ModelRegistryAdapter } from './modelRegistry.ts';

interface FakeModel {
  value: string;
  language: string;
  replacements: number;
  setValueCalls: number;
  disposeCalls: number;
}

const assert = (condition: unknown, message: string): void => {
  if (!condition) throw new Error(`model registry self-check failed: ${message}`);
};

const models: FakeModel[] = [];
const adapter: ModelRegistryAdapter<FakeModel> = {
  createModel(content, language) {
    const model = { value: content, language, replacements: 0, setValueCalls: 0, disposeCalls: 0 };
    models.push(model);
    return model;
  },
  getValue: (model) => model.value,
  setLanguage(model, language) { model.language = language; },
  replaceAll(model, content) { model.replacements += 1; model.value = content; },
  disposeModel(model) { model.disposeCalls += 1; }
};

const registry = new TabModelRegistry(adapter, (language) => language === 'js' ? 'javascript' : language);
const first = registry.getOrCreate('tab-a', 'alpha', 'js');
assert(first.language === 'javascript', 'normalizes the language when creating a model');
assert(registry.getOrCreate('tab-a', 'ignored', 'plaintext') === first, 'reuses the exact model for the same tab ID');
assert(registry.syncExternalContent('tab-a', 'alpha') === false, 'does not edit equal external content');
assert(first.replacements === 0, 'does not invoke the edit adapter for equal content');
assert(registry.syncExternalContent('tab-a', 'beta') === true, 'applies changed external content');
assert(first.replacements === 1 && first.value === 'beta', 'applies one full replacement for changed content');
assert(first.setValueCalls === 0, 'never calls setValue while synchronizing existing models');
assert(registry.setLanguage('tab-a', 'typescript') === true, 'updates changed model language');
assert(first.language === 'typescript' && registry.getOrCreate('tab-a', '', 'plaintext') === first, 'language changes preserve model identity');
assert(registry.setLanguage('tab-a', 'typescript') === false, 'skips equal language updates');

const second = registry.getOrCreate('tab-b', 'bravo', 'plaintext');
registry.retain(['tab-a']);
assert(second.disposeCalls === 1 && first.disposeCalls === 0, 'disposes only models outside the live tab set');
assert(registry.dispose('tab-b') === false && second.disposeCalls === 1, 'does not dispose an already removed model twice');
registry.disposeAll();
assert(first.disposeCalls === 1, 'disposes retained models during full cleanup');
assert(registry.size === 0, 'is empty after full cleanup');
registry.disposeAll();
assert(first.disposeCalls === 1, 'full cleanup is idempotent');

console.log('PASS model registry lifecycle self-check');
