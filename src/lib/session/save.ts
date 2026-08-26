import type { SessionState, SessionTab } from './model.ts';

export interface SaveRequest {
  readonly tabId: string;
  readonly content: string;
  readonly encoding?: string;
  readonly lineEnding?: SessionTab['lineEnding'];
  readonly title: string;
  readonly filePath?: string;
  readonly kind: SessionTab['kind'];
}

export function captureSaveRequest(tab: SessionTab): Readonly<SaveRequest> {
  return Object.freeze({
    tabId: tab.id,
    content: tab.content,
    encoding: tab.encoding,
    lineEnding: tab.lineEnding,
    title: tab.title,
    filePath: tab.filePath,
    kind: tab.kind
  });
}

export function applySaveResult(state: SessionState, request: SaveRequest, savedPath: string): SessionState {
  if (!state.tabs.some((tab) => tab.id === request.tabId)) return state;
  const title = savedPath.split('/').at(-1) || request.title;
  return {
    ...state,
    tabs: state.tabs.map((tab) => {
      if (tab.id !== request.tabId) return tab;
      const bufferUnchanged = tab.content === request.content
        && tab.encoding === request.encoding
        && tab.lineEnding === request.lineEnding;
      return {
        ...tab,
        filePath: savedPath,
        kind: 'file',
        title,
        manuallyNamed: true,
        dirty: !bufferUnchanged
      };
    })
  };
}
