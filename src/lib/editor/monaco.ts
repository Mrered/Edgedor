import * as monaco from 'monaco-editor';

const languageAliases: Record<string, string> = { js: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript', rs: 'rust', py: 'python', md: 'markdown', yml: 'yaml', sh: 'shell' };

export function createEditor(container: HTMLElement, fontSize = 14, language = 'plaintext'): monaco.editor.IStandaloneCodeEditor {
  const model = monaco.editor.createModel('', languageAliases[language] ?? language);
  return monaco.editor.create(container, { model, theme: matchMedia('(prefers-color-scheme: dark)').matches ? 'vs-dark' : 'vs', fontFamily: 'SF Mono, Menlo, monospace', fontSize, automaticLayout: true, minimap: { enabled: true }, padding: { top: 18, bottom: 18 }, wordWrap: 'on' });
}
