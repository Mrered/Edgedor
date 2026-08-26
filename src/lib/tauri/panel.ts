import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

export type PanelAction = 'show' | 'focus' | 'hide' | 'lower';
export type PanelStatus = { visible: boolean; focused: boolean; bridgeReady: boolean; triggerEdge?: 'left' | 'right' };

export function panelAction(action: PanelAction): Promise<PanelStatus> {
  return invoke<PanelStatus>('panel_action', { action });
}

export function listenPanelStatus(handler: (status: PanelStatus) => void): Promise<UnlistenFn> {
  return listen<PanelStatus>('panel_status', (event) => handler(event.payload));
}
