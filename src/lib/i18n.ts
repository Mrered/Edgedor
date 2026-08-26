export type Locale = 'zh-CN' | 'en';

export const localeFromLanguages = (languages: readonly string[] | undefined): Locale => {
  const preferred = languages?.[0]?.toLowerCase() ?? '';
  return preferred.startsWith('zh') ? 'zh-CN' : 'en';
};

export function detectLocale(): Locale {
  return localeFromLanguages(typeof navigator === 'undefined' ? undefined : navigator.languages);
}

const zhCN = {
  appTitle: 'Edgedor', toolbarAria: '工作台工具栏', new: '新建', newTab: '新建临时标签', openFile: '打开文件', previewFile: '预览文件',
  save: '保存', saveActiveTitle: '保存当前标签（⌘S）', split: '分区', addSplitTitle: '新建编辑分区（最多四个）', toggleSplitTitle: '切换分区方向',
  splitHorizontal: '上下分区', splitVertical: '左右分区', merge: '合并', mergeTitle: '合并当前编辑分区', search: '查找', searchTitle: '跨标签查找（⌘⇧F）',
  settings: '设置', commandPanel: '命令面板', commandPlaceholder: '输入命令…', noCommands: '没有匹配命令', pdfPreview: 'PDF 预览', filePreviewAlt: '文件预览', refreshPreview: '重新读取预览', refresh: '刷新', pin: '固定面板', unpin: '取消固定', tabsAria: '编辑标签', previewSuffix: '预览', closeTabAria: '关闭 {name}',
  tabDragHint: '（双击重命名，可拖到其他分区）', restoreClosed: '撤销关闭', expired: '超时', closed: '关闭', noUndo: '没有撤销记录',
  workspaceAria: '临时编辑区', groupAria: '编辑分区 {id}', newGroupTab: '新建分区标签', separatorAria: '调整编辑分区 {leading} 和 {trailing} 的比例', separatorKeyboardHint: '使用方向键微调，Home 和 End 移到可用范围两端', nativeReady: '原生面板已连接', nativeConnecting: '正在连接原生面板…',
  tabCount: '{count} 个标签', undoCount: '撤销槽 {count}/10', crossTabSearch: '跨标签查找', closeSearch: '关闭查找', searchPlaceholder: '输入要查找的内容',
  searchInputAria: '查找内容', noMatches: '没有匹配内容', settingsDialog: 'Edgedor 设置', closeSettings: '关闭设置', shortcutProfile: '编辑器快捷键方案',
  vimEditor: 'Vim（编辑区）', edgeModifier: '边缘呼出修饰键', leftEdge: '启用左侧边缘', rightEdge: '启用右侧边缘', edgeDwell: '边缘停留时间（毫秒）', panelAnimation: '面板动画', animationDuration: '动画时长（毫秒）', commandKey: 'Command（⌘）', optionKey: 'Option（⌥）', controlKey: 'Control（⌃）', shiftKey: 'Shift（⇧）',
  tabLayout: '标签布局', tabTop: '顶部标签', tabLeft: '左侧标签', tabRight: '右侧标签', topTabBehavior: '顶部标签宽度', tabScroll: '保持宽度并滚动', tabCompress: '压缩到可视区域', splitRatio: '分区比例', customShortcuts: '自定义编辑器快捷键',
  shortcutPlaceholder: '留空使用方案默认值', shortcutAria: '{name}快捷键', fontSize: '编辑器字号', editorRegion: '编辑器区域', lineNumbers: '行号', minimap: 'Minimap',
  folding: '代码折叠', glyphMargin: '字形边栏', tabBar: '标签栏', breadcrumbs: '面包屑', statusBar: '编辑器状态栏', languageMode: '语言模式', preserveRestart: '重启后恢复最后工作状态', showMenuBar: '显示菜单栏图标', showDock: '显示 Dock 图标',
  launchAtLogin: '登录时启动 Edgedor', expiryNote: '临时标签 24 小时未访问会过期，并进入可撤销槽。文件只有触发保存时才写回原路径。',
  clearWorkspace: '清空标签和撤销槽', checkUpdates: '检查更新', noUpdates: '已是最新版本', updateFound: '发现新版本 {version}，现在安装？', updateFailed: '检查更新失败：', quitCheckpointFailed: '退出前保存恢复状态失败。', quitWithoutSaveConfirm: '无法写入本次恢复状态。\n\n确定：不保存并继续退出，本次未写入的恢复状态将丢失。\n取消：留在 Edgedor（默认安全选择）。', panelHiddenCheckpointFailed: '面板已隐藏，但恢复状态保存失败。', updateRestartCheckpointFailed: '更新已准备，但恢复状态保存失败，已取消重启。', done: '完成', selectNextOccurrence: '逐个选择相同内容', selectAllOccurrences: '选择所有相同内容',
  addCursorAbove: '上方添加光标', addCursorBelow: '下方添加光标', moveLineUp: '上移行', moveLineDown: '下移行', deleteLine: '删除行', toggleComment: '切换行注释',
  tabClosed: '{name} 已关闭，可用“撤销关闭”恢复', renameTab: '重命名标签', nothingToRestore: '没有可撤销的关闭标签', tabRestored: '{name} 已恢复',
  tabRestoredExpired: '{name} 已恢复（原标签已超时）', textFiles: '文本文件', unnamedFile: '文件', fileSaved: '{name} 已保存', saveFailed: '保存失败：',
  invalidShortcut: '快捷键格式无效，例如 Cmd+Shift+L', shortcutConflict: '该快捷键已被另一条自定义命令使用', dockSettingFailed: 'Dock 图标设置失败：', loginSettingFailed: '登录启动设置失败：',
  modifierChanged: '边缘触发键已改为 {modifier}', nativeTriggerUnavailable: '设置已保存，原生边缘触发接口尚未连接', previewRefreshed: '{name} 已刷新',
  refreshFailed: '刷新失败：', clearConfirm: '清空所有标签和撤销槽？真实文件不会被删除。', workspaceCleared: '工作区已清空', splitLimit: '最多可以创建四个编辑分区',
  oneGroupOnly: '当前只有一个编辑分区', previewRestoreFailed: '{name} 无法恢复，已关闭', unsupportedPreview: '不支持预览此文件：', unsupportedOpen: '不支持打开此文件：',
  tabsExpired: '{count} 个未访问标签已超时，已放入撤销槽', resetConfirm: '恢复所有设置为默认值？标签内容和真实文件不会被删除。', settingsReset: '设置已恢复为默认值',
  filePathInvalid: '{name} 的原路径已失效，已转为临时标签', allTabsExpiryNote: '所有标签 24 小时未访问会过期，并进入当前运行期间的可撤销槽。文件只有触发保存时才写回原路径。', resetSettings: '恢复出厂设置'
} as const;

const en: Record<keyof typeof zhCN, string> = {
  appTitle: 'Edgedor', toolbarAria: 'Workspace toolbar', new: 'New', newTab: 'New temporary tab', openFile: 'Open File', previewFile: 'Preview File',
  save: 'Save', saveActiveTitle: 'Save active tab (⌘S)', split: 'Split', addSplitTitle: 'Create editor group (maximum four)', toggleSplitTitle: 'Switch split direction',
  splitHorizontal: 'Split Down', splitVertical: 'Split Right', merge: 'Merge', mergeTitle: 'Merge active editor group', search: 'Search', searchTitle: 'Search across tabs (⌘⇧F)',
  settings: 'Settings', commandPanel: 'Command Palette', commandPlaceholder: 'Type a command…', noCommands: 'No matching commands', pdfPreview: 'PDF preview', filePreviewAlt: 'File preview', refreshPreview: 'Reload preview', refresh: 'Refresh', pin: 'Pin Panel', unpin: 'Unpin', tabsAria: 'Editor tabs', previewSuffix: 'Preview', closeTabAria: 'Close {name}',
  tabDragHint: ' (double-click to rename; drag to another group)', restoreClosed: 'Reopen Closed', expired: 'Expired', closed: 'Closed', noUndo: 'No recently closed tabs',
  workspaceAria: 'Temporary editor workspace', groupAria: 'Editor group {id}', newGroupTab: 'New Group Tab', separatorAria: 'Resize editor groups {leading} and {trailing}', separatorKeyboardHint: 'Use arrow keys for small adjustments; Home and End move to either allowed limit', nativeReady: 'Native panel connected', nativeConnecting: 'Connecting native panel…',
  tabCount: '{count} tabs', undoCount: 'Undo slots {count}/10', crossTabSearch: 'Search Across Tabs', closeSearch: 'Close search', searchPlaceholder: 'Enter text to find',
  searchInputAria: 'Search text', noMatches: 'No matches', settingsDialog: 'Edgedor Settings', closeSettings: 'Close settings', shortcutProfile: 'Editor keymap',
  vimEditor: 'Vim (editor)', edgeModifier: 'Edge trigger modifier', leftEdge: 'Enable left edge', rightEdge: 'Enable right edge', edgeDwell: 'Edge dwell (ms)', panelAnimation: 'Panel animation', animationDuration: 'Animation duration (ms)', commandKey: 'Command (⌘)', optionKey: 'Option (⌥)', controlKey: 'Control (⌃)', shiftKey: 'Shift (⇧)',
  tabLayout: 'Tab layout', tabTop: 'Tabs on top', tabLeft: 'Tabs on left', tabRight: 'Tabs on right', topTabBehavior: 'Top tab width', tabScroll: 'Keep width and scroll', tabCompress: 'Compress to fit', splitRatio: 'Split ratio', customShortcuts: 'Custom editor shortcuts',
  shortcutPlaceholder: 'Leave blank to use keymap default', shortcutAria: '{name} shortcut', fontSize: 'Editor font size', editorRegion: 'Editor area', lineNumbers: 'Line numbers', minimap: 'Minimap',
  folding: 'Code folding', glyphMargin: 'Glyph margin', tabBar: 'Tab bar', breadcrumbs: 'Breadcrumbs', statusBar: 'Editor status bar', languageMode: 'Language mode', preserveRestart: 'Restore last workspace after restart', showMenuBar: 'Show menu bar icon', showDock: 'Show Dock icon',
  launchAtLogin: 'Launch Edgedor at login', expiryNote: 'Temporary tabs expire after 24 hours without access and move to an undo slot. Files are written back only when you explicitly save.',
  clearWorkspace: 'Clear Tabs and Undo Slots', checkUpdates: 'Check for Updates', noUpdates: 'Edgedor is up to date', updateFound: 'Version {version} is available. Install now?', updateFailed: 'Update check failed: ', quitCheckpointFailed: 'Could not save recovery state before quitting.', quitWithoutSaveConfirm: 'The current recovery state could not be written.\n\nOK: quit without saving; the unwritten recovery state will be lost.\nCancel: stay in Edgedor (the default safe choice).', panelHiddenCheckpointFailed: 'The panel is hidden, but its recovery state could not be saved.', updateRestartCheckpointFailed: 'The update is ready, but recovery state could not be saved, so restart was cancelled.', done: 'Done', selectNextOccurrence: 'Select next occurrence', selectAllOccurrences: 'Select all occurrences',
  addCursorAbove: 'Add cursor above', addCursorBelow: 'Add cursor below', moveLineUp: 'Move line up', moveLineDown: 'Move line down', deleteLine: 'Delete line', toggleComment: 'Toggle line comment',
  tabClosed: '{name} closed. Use Reopen Closed to restore it.', renameTab: 'Rename tab', nothingToRestore: 'No closed tab to restore', tabRestored: '{name} restored',
  tabRestoredExpired: '{name} restored (the original tab had expired)', textFiles: 'Text files', unnamedFile: 'File', fileSaved: '{name} saved', saveFailed: 'Save failed: ',
  invalidShortcut: 'Invalid shortcut. Example: Cmd+Shift+L', shortcutConflict: 'This shortcut is already used by another custom command', dockSettingFailed: 'Could not update Dock icon setting: ', loginSettingFailed: 'Could not update login item: ',
  modifierChanged: 'Edge trigger modifier changed to {modifier}', nativeTriggerUnavailable: 'Setting saved; the native edge trigger is not connected', previewRefreshed: '{name} refreshed',
  refreshFailed: 'Refresh failed: ', clearConfirm: 'Clear all tabs and undo slots? Original files will not be deleted.', workspaceCleared: 'Workspace cleared', splitLimit: 'You can create up to four editor groups',
  oneGroupOnly: 'There is only one editor group', previewRestoreFailed: '{name} could not be restored and was closed', unsupportedPreview: 'This file cannot be previewed: ', unsupportedOpen: 'This file cannot be opened: ',
  tabsExpired: '{count} inactive tabs expired and moved to undo slots', resetConfirm: 'Restore all settings to defaults? Tab contents and original files will not be deleted.', settingsReset: 'Settings restored to defaults',
  filePathInvalid: 'The original path for {name} is unavailable; the tab is now temporary', allTabsExpiryNote: 'All tabs expire after 24 hours without access and move to an undo slot for the current run. Files are written back only when you explicitly save.', resetSettings: 'Restore Default Settings'
};

const messages: Record<Locale, Record<keyof typeof zhCN, string>> = { 'zh-CN': zhCN, en };
export type MessageKey = keyof typeof zhCN;
export type MessageParams = Record<string, string | number>;

export function createTranslator(locale: Locale = detectLocale()) {
  return (key: MessageKey, params: MessageParams = {}): string => messages[locale][key].replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? `{${name}}`));
}
