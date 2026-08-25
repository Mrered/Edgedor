import * as monaco from 'monaco-editor';

export function createEditor(container: HTMLElement): monaco.editor.IStandaloneCodeEditor {
  const model = monaco.editor.createModel('', 'plaintext');
  return monaco.editor.create(container, { model, theme: matchMedia('(prefers-color-scheme: dark)').matches ? 'vs-dark' : 'vs', fontFamily: 'SF Mono, Menlo, monospace', fontSize: 14, automaticLayout: true, minimap: { enabled: false }, padding: { top: 18, bottom: 18 }, wordWrap: 'on' });
}
