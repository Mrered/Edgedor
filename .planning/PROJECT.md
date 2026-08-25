# Edgedor

## What This Is

Edgedor 是一款仅面向最新版 macOS 和 Apple Silicon 的侧边临时代码编辑工作台。用户按住可配置的修饰键并把鼠标移到任意显示器的左右边缘，即可呼出一个覆盖当前工作的 Monaco 编辑器；它用于临时粘贴、调整、查找、替换代码和文本，而不是长期保存笔记。

Edgedor 只有一个应用实例和一个侧边窗口，但窗口内支持多个临时标签、真实文件标签、Quick Look 预览标签和可自由拆分的编辑组。应用默认恢复最后工作状态，同时通过 24 小时未访问自动过期机制保持暂存区短命、轻量。

## Core Value

在不离开当前工作上下文的前提下，以接近 VS Code 编辑区域的快捷键和编辑行为，瞬间获得一个可恢复但会自动过期的临时代码工作台。

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] 用户可以按住一套可配置的修饰键并贴近任意显示器的左侧或右侧边缘，在可配置停留时间后呼出 Edgedor。
- [ ] 用户可以在 Monaco 编辑器中使用 VS Code 编辑区域支持的多光标、列选择、移动行、删除行、逐个选择相同内容、查找替换等行为。
- [ ] 用户可以在 VS Code、Sublime Text、JetBrains 和 Vim 键位方案之间切换，并通过图形界面录入自定义快捷键。
- [ ] 用户可以创建多个临时标签，在多个编辑组之间拖动标签，并自由进行横向或纵向拆分。
- [ ] 应用可以恢复全部标签、内容、顺序、语言模式、活动标签、编辑组布局、光标、选区、滚动位置和面板宽度。
- [ ] 连续 24 小时未访问的标签会静默过期，并进入当前运行期间最多 10 个标签的撤销关闭槽位。
- [ ] 用户可以打开、编辑和主动保存单个真实文本文件；未执行保存命令时绝不写入原文件。
- [ ] 用户可以粘贴或拖入多个文件；文本文件进入 Monaco，macOS Quick Look 支持的文件进入只读预览标签。
- [ ] 用户可以通过 Finder 的“打开方式”把文件发送到唯一的 Edgedor 实例。
- [ ] 用户可以通过顶部 Liquid Glass 工具栏管理标签、拆分、设置、大头针和应用退出。
- [ ] 应用可以通过公开 GitHub Release 自动检查、下载并安装经过 Tauri 更新签名的版本。

### Out of Scope

- 笔记库、文件夹、标签、提醒和历史版本 — Edgedor 是有限寿命的临时缓冲区，不是知识管理应用。
- 富文本、待办和内嵌图片编辑 — 主体是代码编辑器；富文本粘贴统一转为纯文本。
- VS Code 扩展生态、语言服务器、调试器和项目工作区 — 首版只覆盖编辑区域行为和本地编辑能力，不重做完整 IDE。
- 文件资源管理器与目录扫描 — 只处理临时标签和用户主动打开的单个文件。
- AI 补全、聊天、联网代码服务和遥测 — 不上传编辑内容、路径或使用数据。
- iCloud、账号系统和跨设备同步 — 恢复状态只存本机应用私有目录。
- Windows、Linux、Intel Mac 和旧版 macOS — 只支持开发时最新版 macOS 26 Tahoe 与 Apple Silicon。
- Mac App Store、Apple Developer ID 签名和公证 — 首版通过未公证 DMG 分发，用户可手动允许首次启动。
- 专用 PDF、图片、Office、音视频解析器 — 非文本预览统一使用 macOS Quick Look。

## Context

用户当前会在其他应用和代码编辑器之间临时复制内容，进行矩阵框选、多处光标编辑、逐个选择相同内容、换行移动、整行删除和批量替换。现有快速便签呼出方便，但编辑器能力不足；完整 VS Code 编辑能力强，却会打断当前窗口和应用上下文。

Flyout 的屏幕边缘滑出模式是交互参考，但 Edgedor 不复制其品牌、素材、源码或笔记管理定位。Edgedor 将原生 macOS 侧边浮层与 Monaco 编辑器结合，并以“像无状态函数一样处理临时输入，但保留唯一的最后工作状态”为产品模型。

典型流程：

1. 用户在其他应用中复制文本或文件。
2. 用户按住设定修饰键，把鼠标移到当前显示器任一侧边。
3. Edgedor 从该侧滑出并自动聚焦上次活动编辑器。
4. 用户粘贴、使用熟悉的编辑快捷键处理内容，或新建、拆分、切换标签。
5. 用户复制结果返回原应用；点击外部或切换应用后，未固定面板隐藏。
6. 应用只在切换标签、隐藏面板或正常退出时写入恢复状态；若关闭了恢复开关，标签内容完全不落盘。

## Constraints

- **技术栈**: Tauri 2 + Svelte 5 + TypeScript + Monaco Editor；Rust 承担应用逻辑，Swift/AppKit 原生扩展承担 `NSPanel`、Liquid Glass、Quick Look 与全局事件。
- **平台**: 只支持最新版 macOS 26 Tahoe 和 Apple Silicon `arm64`，不为旧系统或 Intel 做兼容层。
- **窗口**: 严格单实例、单窗口；面板始终占满当前显示器可用高度，宽度默认 35%，可在 20%～60% 之间拖动并按屏幕比例保存。
- **权限**: 可以请求辅助功能或输入监控权限，以稳定检测全局修饰键、鼠标和多显示器边缘。
- **性能**: 文本文件最大 20 MB；超出上限只提示，不创建标签。非文本预览交给 Quick Look。
- **隐私**: 不加密本地恢复数据，行为类似 VS Code Hot Exit；依赖 macOS 用户权限与磁盘保护。不开启恢复时，标签内容不得写入磁盘。
- **保存**: 自动状态保存只发生在切换标签、隐藏面板和正常退出时。真实文件只有用户单次执行 `⌘S` 才写回，且直接覆盖当前绑定路径。
- **质量策略**: 优先快速交付，以编译检查和人工冒烟为主；不在首版建设完整自动测试体系。
- **交付**: 分阶段小步提交，每个里程碑保持可运行并产出可安装版本；最终通过公开 GitHub 仓库、Actions、Release 和 Tauri Updater 发布。
- **许可证**: MIT。

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| 产品名为 Edgedor | 结合 Edge 与 Editor，避免沿用 Flyout 品牌 | — Pending |
| 使用 Tauri 2 而非 Electron | 保持轻量，同时允许 Rust 与 macOS 原生扩展 | — Pending |
| 使用 Svelte 5 + TypeScript | 界面代码轻量，适合单窗口工具 | — Pending |
| 使用 Monaco Editor | 最大程度复用 VS Code 编辑区域的快捷键和行为 | — Pending |
| 采用原生 Liquid Glass 外壳 | 与 macOS 26 视觉融合；编辑区保持高对比背景 | — Pending |
| 单实例、单窗口、多编辑组 | 保持侧边工具定位，同时支持复杂临时编辑布局 | — Pending |
| 默认触发键为 Command，可配置任意精确修饰键组合 | 避免普通贴边误触；忽略 Caps Lock | — Pending |
| 左右边缘及显示器内部接缝都可触发 | 鼠标在哪块屏幕就在哪块屏幕工作 | — Pending |
| 触发后锁定显示器 | 防止按住修饰键跨屏时窗口乱跳 | — Pending |
| 默认停留 150 ms，可配置 | 平衡速度与误触 | — Pending |
| 热区按显示器缩放自动计算 | Retina 与非 Retina 保持一致手感 | — Pending |
| 面板换侧时同步播放旧侧隐藏与新侧出现动画 | 形成从屏幕后方穿越的连续感 | — Pending |
| 大头针只阻止隐藏，不代表始终置顶 | 面板聚焦时置顶，切换应用后降为普通层级 | — Pending |
| 支持全屏空间与台前调度浮层 | 不打断当前应用和工作上下文 | — Pending |
| 外部点击或切换应用隐藏，Esc 不隐藏 | 保留 Monaco/VS Code 的 Esc 行为 | — Pending |
| 标签名由首行内容和语言自动生成，可手动重命名 | 临时内容也能快速识别 | — Pending |
| 最近关闭槽位最多 10 个且不跨重启 | 提供短期纠错，不演变成历史库 | — Pending |
| 标签 24 小时未访问自动过期 | 保持暂存区有限寿命 | — Pending |
| 编辑组获得焦点时重置其活动标签寿命 | 与拆分编辑器中的实际使用一致 | — Pending |
| 默认恢复全部工作状态 | 重启后继续最后一次工作，不保留历史版本 | — Pending |
| 恢复开关关闭时内容完全不落盘 | 提供明确无痕语义 | — Pending |
| 文本文件保持原编码和换行符 | 避免主动保存时造成无关格式变化 | — Pending |
| 原文件外部变化不触发冲突检查 | `⌘S` 是明确的单次覆盖动作 | — Pending |
| 文件路径失效后转为普通临时标签 | 保留内容，不维持失效绑定 | — Pending |
| Quick Look 预览只手动刷新 | 不增加文件监听复杂度 | — Pending |
| 顶部标签支持压缩或滚动，侧边标签自动远离屏幕边缘 | 适配不同宽度和左右侧面板 | — Pending |
| 默认只显示菜单栏图标，可分别隐藏菜单栏或显示 Dock 图标 | 保持轻量，同时保留用户控制 | — Pending |
| 菜单栏左键切换面板、右键打开菜单 | 快速操作与完整操作兼顾 | — Pending |
| 公开 GitHub 仓库与 Tauri Updater | 用 CI/CD 自动产生和分发版本 | — Pending |
| 不收集遥测和崩溃报告 | 临时内容工具应保持本地与私密 | — Pending |

## Detailed Interaction Contract

### Panel Activation and Placement

- 左侧和右侧共用一套修饰键设置，并可分别关闭某一侧。
- 修饰键必须精确匹配，额外按下其他修饰键时不触发；`Caps Lock` 不参与匹配。
- 每块显示器的左右边缘都可触发，包括显示器之间的内部接缝。
- 面板在最初触发的显示器上锁定到本次隐藏；鼠标跨屏不迁移。
- Dock 位于左右侧时，按住触发键优先呼出 Edgedor；未按触发键时不干扰 Dock。
- 菜单栏呼出使用上次成功触发的显示器与侧边；显示器失效时回退到主显示器右侧。
- 面板获得焦点后覆盖普通窗口；失去焦点后降为普通层级。
- 未固定时，点击外部或切换到其他应用立即隐藏；固定后两者都不隐藏。
- 固定状态不跨重启，应用每次启动时隐藏且未固定。

### Editor and Keybindings

- 呼出后自动聚焦当前编辑器，恢复光标、选区和滚动位置。
- 支持 Monaco 可提供的 VS Code 编辑区域命令，不承诺扩展或工作台命令兼容。
- 内置 VS Code、Sublime Text、JetBrains 和 Vim 四套方案，默认 VS Code。
- 图形化快捷键设置页允许按键录入和逐条覆盖，不导入或导出 `keybindings.json`。
- `⇧⌘P` 打开 Edgedor 命令面板；`⌘N` 新建空标签；`⇧⌘T` 恢复最近关闭标签。
- `⌘W` 关闭标签；关闭最后标签后显示空工作区，不自动新建、不隐藏面板。
- `⌘+`、`⌘-` 和 `⌘0` 调整并记住字号；字体固定使用 macOS 系统等宽字体。
- `Esc` 完全交给编辑器、补全、查找和多光标逻辑，不承担隐藏窗口。
- 支持行号、状态栏、标签栏、Minimap、面包屑和代码折叠，并允许逐项关闭。
- 自动识别语言并允许在状态栏手动切换；手动选择随标签恢复。
- 提供语法高亮、括号匹配、自动缩进和基础单词补全，不接语言服务器、格式化器、Emmet 或 AI。
- 提供当前标签查找替换和跨全部已打开标签搜索，不扫描磁盘和撤销槽位。

### Tabs, Groups, and Lifecycle

- 标签自动用首行内容与语言命名；用户手动重命名后不再自动覆盖。
- 标签可拖入其他编辑组；编辑组可自由横向或纵向拆分并记住比例。
- 空编辑组是否自动关闭由设置控制，默认自动关闭。
- 顶部标签可选择压缩或单行滚动；另有侧边纵向标签布局。
- 侧边标签自动位于远离屏幕触发边缘的一侧，面板穿越后同步翻转。
- 所有普通、文件和预览标签都遵守 24 小时寿命。
- 标签关闭或过期时进入同一撤销栈，占用同样的 10 个槽位。
- 槽位保存内容、名称、语言、编辑状态、文件绑定和预览信息；退出后清空。
- 应用关闭期间继续计算寿命；启动时过期的最近 10 个标签进入新撤销栈，更旧者淘汰。

### Files, Clipboard, and Preview

- 富文本粘贴自动转为纯文本。
- 剪贴板中一个或多个文件分别打开为标签；不支持项集中提示但不影响支持项。
- 拖入一个或多个文件与粘贴文件行为一致。
- 支持 UTF-8、UTF-16、GB18030 等常见编码自动检测，保存时保持原编码与换行格式。
- 临时标签按 `⌘S` 时请求保存路径；保存成功后转为绑定文件标签。
- 绑定文件标签仅在用户执行 `⌘S` 时覆盖磁盘文件，不自动保存，不检查外部修改冲突。
- 绑定路径失效时自动解除绑定并转为普通临时标签。
- PDF、图片、Office 文档及其他系统支持格式使用 Quick Look 只读预览。
- Quick Look 标签不监听外部变化，只提供手动刷新。
- 无法编辑或预览的文件只显示轻量提示，不创建标签、不调用默认应用、不插入路径。
- Finder 使用 Edgedor 打开文件时复用唯一实例，显示面板并选中新标签。

### Settings and Distribution

- 界面根据 macOS 系统语言自动切换简体中文或英文。
- 外观只跟随 macOS 浅色或深色模式，不提供独立主题。
- 默认不登录启动，可在设置中开启。
- 设置中提供“清空标签与撤销记录”和“恢复出厂设置”。
- 默认只显示菜单栏图标且不显示 Dock；两者可分别控制。
- 即使两者都隐藏，也可先通过贴边呼出，再用 `⌘,` 打开设置或 `⌘Q` 退出；工具栏保留图形入口。
- 第一版提供 Apple Silicon DMG，不要求 Apple 公证。
- GitHub Actions 生成安装包、更新包、签名和 Release 元数据；公开 Release 作为更新源。

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-08-26 after initialization*
