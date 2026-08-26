export interface ModelRegistryAdapter<Model> {
  createModel(content: string, language: string): Model;
  getValue(model: Model): string;
  setLanguage(model: Model, language: string): void;
  replaceAll(model: Model, content: string): void;
  disposeModel(model: Model): void;
}

interface RegistryEntry<Model> {
  model: Model;
  language: string;
}

export class TabModelRegistry<Model> {
  private readonly entries = new Map<string, RegistryEntry<Model>>();
  private readonly adapter: ModelRegistryAdapter<Model>;
  private readonly normalizeLanguage: (language: string) => string;

  constructor(
    adapter: ModelRegistryAdapter<Model>,
    normalizeLanguage: (language: string) => string = (language) => language
  ) {
    this.adapter = adapter;
    this.normalizeLanguage = normalizeLanguage;
  }

  get size(): number {
    return this.entries.size;
  }

  getOrCreate(tabId: string, content: string, language: string): Model {
    const existing = this.entries.get(tabId);
    if (existing) return existing.model;
    const normalizedLanguage = this.normalizeLanguage(language);
    const model = this.adapter.createModel(content, normalizedLanguage);
    this.entries.set(tabId, { model, language: normalizedLanguage });
    return model;
  }

  syncExternalContent(tabId: string, content: string): boolean {
    const entry = this.entries.get(tabId);
    if (!entry || this.adapter.getValue(entry.model) === content) return false;
    this.adapter.replaceAll(entry.model, content);
    return true;
  }

  setLanguage(tabId: string, language: string): boolean {
    const entry = this.entries.get(tabId);
    if (!entry) return false;
    const normalizedLanguage = this.normalizeLanguage(language);
    if (entry.language === normalizedLanguage) return false;
    this.adapter.setLanguage(entry.model, normalizedLanguage);
    entry.language = normalizedLanguage;
    return true;
  }

  retain(tabIds: Iterable<string>): void {
    const retained = new Set(tabIds);
    for (const tabId of this.entries.keys()) {
      if (!retained.has(tabId)) this.dispose(tabId);
    }
  }

  dispose(tabId: string): boolean {
    const entry = this.entries.get(tabId);
    if (!entry) return false;
    this.entries.delete(tabId);
    this.adapter.disposeModel(entry.model);
    return true;
  }

  disposeAll(): void {
    for (const tabId of [...this.entries.keys()]) this.dispose(tabId);
  }
}
