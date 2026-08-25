# Requirements: Edgedor

**Defined:** 2026-08-26
**Core Value:** 在不离开当前工作上下文的前提下，以接近 VS Code 编辑区域的快捷键和编辑行为，瞬间获得一个可恢复但会自动过期的临时代码工作台。

## v1 Requirements

### Foundation

- [ ] **FOUND-01**: 用户可以安装并启动 Apple Silicon 版本的 Edgedor DMG。
- [ ] **FOUND-02**: Edgedor 只运行一个应用实例和一个侧边窗口。
- [ ] **FOUND-03**: 应用界面使用 macOS 系统语言，在简体中文和英文之间自动切换。
- [ ] **FOUND-04**: 应用外观跟随 macOS 浅色/深色模式，编辑器使用可读的等宽编辑区。

### Panel

- [ ] **PANEL-01**: 用户可以配置一套精确匹配的 Command、Option、Control、Shift 修饰键组合，Caps Lock 不参与匹配。
- [ ] **PANEL-02**: 用户按住触发组合并在任意显示器左右边缘停留达到默认 150ms 后，面板从对应侧滑出。
- [ ] **PANEL-03**: 左右侧触发可以分别开关，停留时间可在设置中调整。
- [ ] **PANEL-04**: 面板触发后锁定最初显示器，鼠标跨屏不会迁移当前面板。
- [ ] **PANEL-05**: 面板高度占满当前显示器可用区域，宽度默认 35%，可在 20%～60% 之间拖动并保存为可用宽度百分比。
- [ ] **PANEL-06**: 面板未固定时，点击外部或切换到其他应用立即隐藏；固定后不因这两种行为隐藏。
- [ ] **PANEL-07**: 面板获得焦点时位于普通窗口之上，失去焦点后降为普通窗口层级。
- [ ] **PANEL-08**: 面板从一侧切换到另一侧时同步播放隐藏和出现动画，动画速度可调且可关闭。
- [ ] **PANEL-09**: 面板支持全屏应用、台前调度和 Dock 左右侧场景；按住触发键时优先于 Dock。
- [ ] **PANEL-10**: 面板提供大头针、设置、退出等图形入口，固定状态不跨重启保留。

### Editor

- [ ] **EDIT-01**: 用户可以在 Monaco 编辑器中创建、输入、选择、复制和粘贴纯文本。
- [ ] **EDIT-02**: 编辑器支持 VS Code 编辑区域可实现的多光标、矩阵/列选择、移动行、删除行和逐个选择相同内容。
- [ ] **EDIT-03**: 编辑器支持语法高亮、括号匹配、自动缩进、代码折叠和基础单词补全。
- [ ] **EDIT-04**: 编辑器自动判断语言模式，并允许用户在状态栏手动切换；手动选择可恢复。
- [ ] **EDIT-05**: 编辑器提供行号、状态栏、标签栏、Minimap、面包屑和查找替换，并允许逐项隐藏。
- [ ] **EDIT-06**: `Esc` 保持 Monaco 编辑行为，不负责隐藏面板。
- [ ] **EDIT-07**: 用户可以使用 `⌘+`、`⌘-`、`⌘0` 调整并记住字号；字体固定为系统等宽字体。
- [ ] **EDIT-08**: `⇧⌘P` 打开 Edgedor 命令面板；隐藏面板时不执行编辑快捷键。
- [ ] **EDIT-09**: 用户可以选择 VS Code、Sublime Text、JetBrains、Vim 四套键位方案，默认 VS Code。
- [ ] **EDIT-10**: 用户可以在图形化设置中录入组合键并逐条覆盖当前键位方案。
- [ ] **EDIT-11**: 用户可以在当前标签内查找替换，也可以跨全部已打开标签搜索。

### Tabs and Session

- [ ] **SESSION-01**: 用户可以创建多个临时标签，标签名称默认来自首行内容和语言模式，手动重命名后保持不变。
- [ ] **SESSION-02**: 用户可以在编辑组之间拖动标签，横向或纵向自由拆分，并恢复拆分比例和活动组。
- [ ] **SESSION-03**: 用户可以选择顶部压缩/横向滚动标签或侧边纵向标签布局；侧边标签自动远离屏幕触发边缘。
- [ ] **SESSION-04**: `⌘N` 创建空临时标签，`⌘W` 关闭标签，关闭最后标签后显示空工作区。
- [ ] **SESSION-05**: `⇧⌘T` 恢复最近关闭或自动过期的标签，撤销槽最多 10 个且仅存在当前运行期间。
- [ ] **SESSION-06**: 所有标签在连续 24 小时未被其编辑组获得焦点后静默过期，并进入撤销槽。
- [ ] **SESSION-07**: 应用启动时按真实时间清理已过期标签，最近 10 个进入本次运行的撤销槽。
- [ ] **SESSION-08**: 应用在切换标签、隐藏面板和正常退出时保存版本化恢复快照，恢复全部标签内容、顺序、布局、光标、选区、滚动位置和活动标签。
- [ ] **SESSION-09**: 设置中默认开启“重启后保留暂存区数据”；关闭后标签内容完全不落盘，退出或崩溃后不可恢复。
- [ ] **SESSION-10**: 设置中提供清空标签/撤销记录和恢复出厂设置，二者均不误删真实文件。

### Files and Preview

- [ ] **FILE-01**: 用户可以主动打开单个真实文本文件，文本文件最大 20 MB。
- [ ] **FILE-02**: 应用自动检测 UTF-8、UTF-16、GB18030 等常见编码并保持原编码和换行符。
- [ ] **FILE-03**: 真实文件标签只绑定路径和编辑器缓冲区；只有用户执行 `⌘S` 才直接覆盖原文件。
- [ ] **FILE-04**: 临时标签执行 `⌘S` 时显示保存面板，成功后转为绑定文件标签。
- [ ] **FILE-05**: 绑定路径失效后保留内容并自动解除绑定，后续 `⌘S` 再次请求保存路径。
- [ ] **FILE-06**: 富文本粘贴自动转为纯文本；一个或多个剪贴板文件分别打开为标签。
- [ ] **FILE-07**: 用户可以拖入一个或多个文件，行为与粘贴文件一致。
- [ ] **FILE-08**: PDF、图片、Office 和其他 macOS Quick Look 支持的格式以只读预览标签打开。
- [ ] **FILE-09**: 预览标签提供手动刷新，不监听外部文件变化。
- [ ] **FILE-10**: 无法编辑或预览的文件只显示“不支持”提示，不创建标签、不调用默认应用、不粘贴路径。
- [ ] **FILE-11**: Finder 的“打开方式 → Edgedor”复用唯一实例，从上次使用侧边显示并选中新标签。

### Distribution

- [ ] **DIST-01**: 默认只显示菜单栏图标且不显示 Dock 图标；二者可分别在设置中开关。
- [ ] **DIST-02**: 用户可以在面板内通过 `⌘,` 打开设置、通过 `⌘Q` 退出应用，即使两个系统图标都隐藏。
- [ ] **DIST-03**: 设置中可开启登录时启动，默认关闭。
- [ ] **DIST-04**: 应用不收集遥测、崩溃报告、编辑内容或路径数据。
- [ ] **DIST-05**: 公开 GitHub 仓库采用 MIT 许可证。
- [ ] **DIST-06**: GitHub Actions 为 Apple Silicon 生成 DMG、Tauri 更新包和 `latest.json` Release 资产。
- [ ] **DIST-07**: Tauri Updater 使用 Actions Secret 中的更新私钥签名，客户端验证签名后自动检查、下载和安装更新。

## User Stories

- 作为正在其他应用中工作的用户，我想按住修饰键贴边快速打开编辑器，不想切换窗口或被普通贴边误触。
- 作为熟悉 VS Code 的用户，我想在临时工作台中继续使用多光标、列选择和行操作，不想重新学习编辑方式。
- 作为处理一次性内容的用户，我想关闭或重启后恢复最后状态，但不想积累永久笔记历史。
- 作为需要修改真实文件的用户，我想明确按 `⌘S` 后才写回原文件，并能处理非 UTF-8 编码。
- 作为 macOS 用户，我想从 Finder 或剪贴板把文件送入唯一 Edgedor 实例，并对 PDF/图片直接预览。

## Acceptance Criteria

- 核心冒烟：在浏览器或终端前台时，授权后按住默认 Command 贴左/右边缘，150ms 内面板出现并自动聚焦当前标签。
- 编辑器冒烟：矩阵选择、多光标、移动/删除行、逐个选择相同内容、查找替换和 `Esc` 行为与 Monaco/VS Code 编辑区域一致。
- 恢复冒烟：创建多个标签和拆分，隐藏/退出后重启，布局、光标、选区、滚动和内容恢复；关闭恢复开关后不恢复任何内容。
- 保存冒烟：打开绑定文件并编辑，不执行 `⌘S` 时原文件 mtime 不变；执行 `⌘S` 后内容覆盖；临时标签 `⌘S` 请求路径。
- 生命周期冒烟：人为调整测试时钟或使用过期 fixture，未访问标签静默进入 10 槽撤销记录，`⇧⌘T` 可恢复。
- 分发冒烟：GitHub Release 同时提供 DMG 和签名更新元数据，旧版本能检查并安装新版本。

## v2 Requirements

### Deferred Integrations

- **V2-01**: 语言服务器、诊断、跳转定义和智能补全。
- **V2-02**: VS Code 主题导入、扩展、Emmet、格式化器和代码片段生态。
- **V2-03**: iCloud 同步、iPhone 客户端和跨设备状态。

## Out of Scope

| Feature | Reason |
|---------|--------|
| 笔记库/文件夹/标签/提醒/历史版本 | 产品是单一临时工作台，不是笔记管理器 |
| 文件夹工作区和文件资源管理器 | 只处理主动打开的单文件，避免重做 VS Code |
| 自动保存原文件 | 破坏“用户主动保存才写入”的安全边界 |
| 未知文件调用默认应用 | 用户已明确要求不支持时什么也不做 |
| 账号、云同步、遥测 | 本地隐私和无状态定位优先 |
| Windows、Linux、Intel、旧 macOS | 首版只支持 macOS 26 Apple Silicon |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| FOUND-01 | Phase 1 | Pending |
| FOUND-02 | Phase 1 | Pending |
| FOUND-03 | Phase 1 | Pending |
| FOUND-04 | Phase 1 | Pending |
| PANEL-01 | Phase 2 | Pending |
| PANEL-02 | Phase 2 | Pending |
| PANEL-03 | Phase 2 | Pending |
| PANEL-04 | Phase 2 | Pending |
| PANEL-05 | Phase 2 | Pending |
| PANEL-06 | Phase 2 | Pending |
| PANEL-07 | Phase 2 | Pending |
| PANEL-08 | Phase 2 | Pending |
| PANEL-09 | Phase 2 | Pending |
| PANEL-10 | Phase 2 | Pending |
| EDIT-01 | Phase 3 | Pending |
| EDIT-02 | Phase 3 | Pending |
| EDIT-03 | Phase 3 | Pending |
| EDIT-04 | Phase 3 | Pending |
| EDIT-05 | Phase 3 | Pending |
| EDIT-06 | Phase 3 | Pending |
| EDIT-07 | Phase 3 | Pending |
| EDIT-08 | Phase 3 | Pending |
| EDIT-09 | Phase 3 | Pending |
| EDIT-10 | Phase 3 | Pending |
| EDIT-11 | Phase 3 | Pending |
| SESSION-01 | Phase 4 | Pending |
| SESSION-02 | Phase 4 | Pending |
| SESSION-03 | Phase 4 | Pending |
| SESSION-04 | Phase 4 | Pending |
| SESSION-05 | Phase 4 | Pending |
| SESSION-06 | Phase 4 | Pending |
| SESSION-07 | Phase 4 | Pending |
| SESSION-08 | Phase 4 | Pending |
| SESSION-09 | Phase 4 | Pending |
| SESSION-10 | Phase 4 | Pending |
| FILE-01 | Phase 5 | Pending |
| FILE-02 | Phase 5 | Pending |
| FILE-03 | Phase 5 | Pending |
| FILE-04 | Phase 5 | Pending |
| FILE-05 | Phase 5 | Pending |
| FILE-06 | Phase 5 | Pending |
| FILE-07 | Phase 5 | Pending |
| FILE-08 | Phase 5 | Pending |
| FILE-09 | Phase 5 | Pending |
| FILE-10 | Phase 5 | Pending |
| FILE-11 | Phase 5 | Pending |
| DIST-01 | Phase 6 | Pending |
| DIST-02 | Phase 6 | Pending |
| DIST-03 | Phase 6 | Pending |
| DIST-04 | Phase 6 | Pending |
| DIST-05 | Phase 6 | Pending |
| DIST-06 | Phase 6 | Pending |
| DIST-07 | Phase 6 | Pending |

**Coverage:**
- v1 requirements: 53 total
- Mapped to phases: 53
- Unmapped: 0 ✓

## Definition of Done

- 功能在目标 macOS 26 Apple Silicon 机器上可运行。
- 相关 `.planning` 条目和实现按主题分别提交。
- 完成必要编译检查与人工冒烟；不把未做的自动测试宣称为通过。
- 不泄漏用户编辑内容、文件路径或更新私钥。

---
*Requirements defined: 2026-08-26*
*Last updated: 2026-08-26 after initial scoping*
