# Roadmap: Edgedor

## Overview

Edgedor 以六个可运行的垂直 MVP 阶段交付：先验证 Tauri 与原生 macOS 面板的桥接和单实例基础，再完成贴边呼出与工作台外壳，随后补齐 Monaco 编辑器行为、临时会话生命周期、文件与 Quick Look，最后收口设置、Apple Silicon 分发和签名更新。阶段按依赖顺序执行；同一阶段内无文件冲突的计划可并行，涉及原生桥接、状态模型或发布产物的计划必须顺序执行。

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [ ] **Phase 1: 基础与原生面板 Spike** - 建立可安装的 Tauri/Svelte/Monaco 壳并验证原生面板桥接
- [ ] **Phase 2: 边缘触发与工作台外壳** - 实现多显示器贴边呼出、焦点层级和面板工具栏
- [ ] **Phase 3: 编辑器快捷键与布局** - 交付 Monaco 编辑能力、键位方案和编辑器级工作台操作
- [ ] **Phase 4: 会话恢复与寿命** - 交付多标签/编辑组的快照恢复、过期和撤销关闭
- [ ] **Phase 5: 文件与 Quick Look** - 交付显式文件保存、编码、剪贴板/拖放和只读预览
- [ ] **Phase 6: 打包、GitHub Actions 与更新** - 完成菜单栏/Dock 设置、DMG、Release 和 Tauri Updater

## Phase Details

### Phase 1: 基础与原生面板 Spike
**Goal**: 用户可以在 Apple Silicon 的最新版 macOS 上安装并启动一个单实例、单窗口的 Edgedor 基础工作台。
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: FOUND-01, FOUND-02, FOUND-03, FOUND-04
**Success Criteria** (what must be TRUE):
  1. 用户可以安装 Apple Silicon DMG 并启动 Edgedor，看到可输入的 Monaco 编辑区域。
  2. 重复打开应用或通过第二个入口时，系统只保留一个应用实例和一个侧边窗口。
  3. 界面随 macOS 系统语言在简体中文和英文之间切换，外观随浅色/深色模式变化且编辑区保持高对比可读。
  4. 原生面板桥接 Spike 在目标 macOS 26 机器上可显示、聚焦并从 Tauri/Svelte 工作台收发基本状态。
**Plans:** 1 plan
Plans:
- [ ] 01-PLAN.md — 建立 Tauri/Svelte/Monaco Walking Skeleton，接入单实例 NSPanel bridge 并验证 arm64 开发产物
**UI hint**: yes

### Phase 2: 边缘触发与工作台外壳
**Goal**: 用户可以用精确修饰键在任意显示器边缘快速呼出并控制 Edgedor 面板，而不打断当前应用上下文。
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: PANEL-01, PANEL-02, PANEL-03, PANEL-04, PANEL-05, PANEL-06, PANEL-07, PANEL-08, PANEL-09, PANEL-10
**Success Criteria** (what must be TRUE):
  1. 用户可配置精确修饰键、左右侧开关和停留时间；默认 Command + 150ms 在任意显示器左右边缘触发。
  2. 触发后面板锁定初始显示器，按显示器可用高度铺满并以 20%～60% 可拖动宽度保存；跨屏不迁移。
  3. 未固定面板在外部点击或切换应用时隐藏，固定面板保持显示；聚焦时高于普通窗口，失焦后降级。
  4. 左右换侧有同步可调/可关闭动画，并能在全屏、台前调度和 Dock 侧边场景下工作。
  5. 用户能通过 Liquid Glass 工具栏完成固定、设置和退出，固定状态不会跨重启保留。
**Plans**: TBD
**UI hint**: yes

### Phase 3: 编辑器快捷键与布局
**Goal**: 用户可以在 Monaco 编辑器中使用熟悉的 VS Code 编辑区域行为、键位方案和工作台级命令。
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: EDIT-01, EDIT-02, EDIT-03, EDIT-04, EDIT-05, EDIT-06, EDIT-07, EDIT-08, EDIT-09, EDIT-10, EDIT-11
**Success Criteria** (what must be TRUE):
  1. 用户可创建并编辑纯文本，完成多光标、列选择、移动/删除行、逐个选择相同内容、语法高亮、括号匹配、缩进、折叠和基础补全。
  2. 编辑器自动识别语言且允许在状态栏切换；行号、状态栏、标签栏、Minimap、面包屑和查找替换可分别隐藏。
  3. `Esc` 始终执行 Monaco 编辑行为；字号可用 `⌘+`、`⌘-`、`⌘0` 调整并记住，`⇧⌘P` 打开命令面板。
  4. 用户可切换 VS Code、Sublime Text、JetBrains、Vim 键位方案，并在图形化设置中逐条录入覆盖快捷键。
  5. 用户可在当前标签查找替换，或跨全部已打开标签搜索。
**Plans**: TBD
**UI hint**: yes

### Phase 4: 会话恢复与寿命
**Goal**: 用户可以管理临时标签和编辑组，并在重启后恢复最近工作，同时让未访问内容按时自动消失。
**Mode:** mvp
**Depends on**: Phase 3
**Requirements**: SESSION-01, SESSION-02, SESSION-03, SESSION-04, SESSION-05, SESSION-06, SESSION-07, SESSION-08, SESSION-09, SESSION-10
**Success Criteria** (what must be TRUE):
  1. 用户可创建、重命名、关闭多个临时标签，在编辑组间拖动并横向/纵向拆分；标签布局可选顶部压缩/滚动或远离触发边的侧边栏。
  2. `⌘N` 创建空标签、`⌘W` 关闭标签且最后标签留下空工作区，`⇧⌘T` 可从当前运行的最多 10 个槽位恢复最近关闭或过期标签。
  3. 标签连续 24 小时未被其编辑组聚焦后静默过期；启动时按真实时间清理，并将最近 10 个放入本次运行撤销槽。
  4. 切换标签、隐藏面板或正常退出后，应用可恢复标签内容/顺序、语言、光标、选区、滚动、活动组和拆分比例。
  5. 关闭恢复开关后标签内容不落盘；清空标签/撤销记录和恢复出厂设置不会删除真实文件。
**Plans**: TBD
**UI hint**: yes

### Phase 5: 文件与 Quick Look
**Goal**: 用户可以安全地把主动选择的文件或剪贴板内容带入工作台，并明确控制真实文件写回。
**Mode:** mvp
**Depends on**: Phase 4
**Requirements**: FILE-01, FILE-02, FILE-03, FILE-04, FILE-05, FILE-06, FILE-07, FILE-08, FILE-09, FILE-10, FILE-11
**Success Criteria** (what must be TRUE):
  1. 用户可打开或拖入/粘贴单个或多个文件；20 MB 内文本进入 Monaco，富文本转纯文本，不支持项只显示提示且不创建标签。
  2. UTF-8、UTF-16、GB18030 等常见编码和换行符可自动识别，并在保存时保持原格式。
  3. 绑定文件只有在用户执行 `⌘S` 时覆盖原路径；临时标签执行 `⌘S` 弹出保存面板，路径失效时保留内容并解除绑定。
  4. PDF、图片、Office 等 Quick Look 支持文件以只读预览标签打开，用户可手动刷新且不会监听外部变化。
  5. Finder“打开方式 → Edgedor”复用唯一实例，从上次侧边显示并选中新标签。
**Plans**: TBD
**UI hint**: yes

### Phase 6: 打包、GitHub Actions 与更新
**Goal**: 用户可以通过轻量系统入口使用 Edgedor，并从公开 Release 安全安装和更新 Apple Silicon 版本。
**Mode:** mvp
**Depends on**: Phase 5
**Requirements**: DIST-01, DIST-02, DIST-03, DIST-04, DIST-05, DIST-06, DIST-07
**Success Criteria** (what must be TRUE):
  1. 默认仅显示菜单栏图标且不显示 Dock 图标；用户可分别切换两者并可在面板内用 `⌘,` 打开设置、`⌘Q` 退出。
  2. 用户可在设置中开启登录时启动（默认关闭），且应用不收集遥测、崩溃报告、编辑内容或路径数据。
  3. 公开 GitHub 仓库包含 MIT 许可证，Actions 可生成 Apple Silicon DMG、Tauri 更新包和 `latest.json` Release 资产。
  4. 客户端使用 Actions Secret 中的更新私钥对应签名验证更新，能够检查、下载并安装新版本。
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6. Within a phase, independent plans may run in parallel; shared native/state/release files remain sequential.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. 基础与原生面板 Spike | 0/TBD | Not started | - |
| 2. 边缘触发与工作台外壳 | 0/TBD | Not started | - |
| 3. 编辑器快捷键与布局 | 0/TBD | Not started | - |
| 4. 会话恢复与寿命 | 0/TBD | Not started | - |
| 5. 文件与 Quick Look | 0/TBD | Not started | - |
| 6. 打包、GitHub Actions 与更新 | 0/TBD | Not started | - |
