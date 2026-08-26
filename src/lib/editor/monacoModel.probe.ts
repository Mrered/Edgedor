import * as monaco from 'monaco-editor';
import { createMonacoModelRegistry } from './monaco';

type UndoableTextModel = monaco.editor.ITextModel & {
  undo(): void | Promise<void>;
  redo(): void | Promise<void>;
};

const assert = (condition: unknown, message: string): void => {
  if (!condition) throw new Error(`Monaco model probe failed: ${message}`);
};

function replace(model: monaco.editor.ITextModel, content: string): void {
  model.pushStackElement();
  model.pushEditOperations(null, [{ range: model.getFullModelRange(), text: content }], () => null);
  model.pushStackElement();
}

export async function runMonacoModelProbe(): Promise<string> {
  const registry = createMonacoModelRegistry();
  const model = registry.getOrCreate('probe-tab', 'zero', 'plaintext') as UndoableTextModel;
  let suppressSessionUpdate = false;
  let unsuppressedCallbacks = 0;
  const subscription = model.onDidChangeContent(() => {
    if (!suppressSessionUpdate) unsuppressedCallbacks += 1;
  });

  try {
    replace(model, 'one');
    replace(model, 'two');
    unsuppressedCallbacks = 0;
    suppressSessionUpdate = true;
    try {
      assert(registry.syncExternalContent('probe-tab', 'external'), 'applies external content');
    } finally {
      suppressSessionUpdate = false;
    }
    assert(model.getValue() === 'external', 'contains the external replacement');
    assert(unsuppressedCallbacks === 0, 'suppresses model callbacks during external synchronization');

    await model.undo();
    assert(model.getValue() === 'two', 'first undo removes only the external replacement');
    await model.undo();
    assert(model.getValue() === 'one', 'second undo reaches the second prior user state');
    await model.undo();
    assert(model.getValue() === 'zero', 'third undo reaches the initial state');
    await model.redo();
    assert(model.getValue() === 'one', 'first redo restores the first user edit');
    await model.redo();
    assert(model.getValue() === 'two', 'second redo restores the second user edit');
    await model.redo();
    assert(model.getValue() === 'external', 'third redo restores the external replacement');

    const result = 'PASS Monaco model undo/redo and suppression probe';
    console.log(result);
    return result;
  } finally {
    subscription.dispose();
    registry.disposeAll();
  }
}
