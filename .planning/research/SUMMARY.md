# Project Research Summary

**Project:** Edgedor
**Domain:** macOS 临时代码编辑器与侧边浮层
**Researched:** 2026-08-26
**Confidence:** MEDIUM

## Executive Summary

Edgedor 的标准实现是“原生 macOS 面板 + Tauri WebView + Monaco”，而不是一个普通网页窗口。Tauri 负责小体积应用壳、Rust 状态和文件边界；Svelte 负责工作台 UI；Swift/AppKit 负责 `NSPanel`、Liquid Glass、Quick Look 和跨应用事件。当前公开文档确认这些 API 路径存在，但把 Swift/AppKit 面板嵌入 Tauri 的具体桥接仍应在第一阶段做小型技术验证。

最大风险不在 Monaco，而在 macOS 窗口层级、全局事件权限、多屏坐标和恢复快照与原文件保存的分离。路线图必须先验证原生面板与权限，再扩展标签、文件和发布；不要先做完整视觉外壳后才发现跨应用行为不可行。

## Key Findings

### Recommended Stack

- Tauri 2.x + Rust stable：应用壳、单实例、状态、文件和更新。
- Svelte 5 + TypeScript：紧凑的工作台、设置和标签 UI。
- Monaco 0.56.x：编辑器区域的 VS Code 风格能力；`monaco-vim` 仅覆盖 Vim 编辑模式。
- Swift/AppKit：`NSPanel`、`NSGlassEffectView`、`QLPreviewView` 和全局事件观察。

### Expected Features

**Must have:**
- 原生侧边呼出、焦点、层级、权限和多显示器锁定。
- Monaco 编辑器、核心快捷键、标签、编辑组和恢复。
- 显式文件保存与临时标签寿命。

**Should have:**
- 四套键位、Quick Look、Finder 打开方式、Liquid Glass 和自动更新。

**Defer:**
- 语言服务器、AI、工作区、同步、移动端和富文本。

### Architecture Approach

1. 原生 panel bridge：窗口、事件、屏幕和 Quick Look。
2. Rust session/file service：版本化快照、寿命、撤销栈和文件编码。
3. Svelte workbench：工具栏、标签、分组、设置和预览容器。
4. Monaco model registry：每个标签一个模型，编辑组只持有视图。

### Critical Pitfalls

1. 先做 `NSPanel` spike，不能把跨应用窗口行为留到最后。
2. 首次运行必须解释辅助功能权限，不能把未授权表现成随机失效。
3. 验收限定 Monaco 编辑区域命令，不承诺 VS Code 工作台/扩展生态。
4. 恢复快照永远不能写原文件，`⌘S` 才能进入覆盖路径。
5. 多屏 Retina 坐标需统一转换，Quick Look 和 WebView 不可各自猜尺寸。

## Implications for Roadmap

### Phase 1: Foundation and Native Panel Spike
**Rationale:** 先验证平台和最小垂直切片，避免错误架构。
**Delivers:** Tauri/Svelte/Monaco 壳、单实例、原生 panel、可安装开发 DMG。
**Avoids:** Web-only 窗口和 Swift 桥接不可行风险。

### Phase 2: Edge Activation and Workbench Chrome
**Rationale:** 侧边呼出是核心价值，依赖 Phase 1 的 panel。
**Delivers:** 权限引导、修饰键贴边、多屏、动画、Liquid Glass 工具栏和菜单栏。

### Phase 3: Editor Parity and Layout
**Rationale:** Monaco 模型稳定后再承诺键位和复杂布局。
**Delivers:** VS Code/Sublime/JetBrains/Vim 方案、命令面板、多标签、编辑组、查找替换。

### Phase 4: Session Persistence and Lifecycle
**Rationale:** 标签模型与布局确定后才能安全持久化。
**Delivers:** Hot Exit、光标/选区/布局恢复、24 小时寿命、10 槽撤销、无痕开关。

### Phase 5: Files and Quick Look
**Rationale:** 文件 I/O 必须建立在稳定 session 模型上，并明确保存边界。
**Delivers:** 编码、20 MB 限制、Finder/拖放/剪贴板、显式保存、Quick Look。

### Phase 6: Packaging and Updates
**Rationale:** 功能可运行后再锁定发布链，避免反复签名和 Release 调试。
**Delivers:** Apple Silicon DMG、MIT 公开仓库、GitHub Actions、签名更新与设置收口。

### Phase Ordering Rationale

- 原生窗口和事件是所有交互的底层依赖，必须先于功能扩展。
- Monaco 编辑器模型先于标签寿命和恢复快照。
- 文件编码与 Quick Look 最后接入，避免破坏临时内容边界。
- 更新链最后接入，因为 Tauri 更新签名与产物版本不可逆地影响发布。

### Research Flags

- **Phase 1/2:** Tauri WebView 与 Swift `NSPanel` 的嵌入、台前调度和权限需实机验证。
- **Phase 3:** Monaco 0.56 与 `monaco-vim` 的键位覆盖需手测，不可只依赖文档。
- **Phase 5:** GB18030/UTF-16 检测、Quick Look view 生命周期需实机验证。
- **Phase 6:** GitHub Actions 的 Apple Silicon runner、updater key 和 Release 清单需真实升级验证。

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM | npm 与 Apple 文档已核实；Rust crate 版本需 Phase 1 lockfile 确认 |
| Features | HIGH | 主要来自用户逐项确认和 VS Code 官方行为 |
| Architecture | MEDIUM | 组件边界清晰，Swift/Tauri 桥接仍需 spike |
| Pitfalls | MEDIUM | 由 Apple/Tauri 文档和目标交互推导，需实机复核 |

**Overall confidence:** MEDIUM

### Gaps to Address

- Tauri 2 桌面端将 Swift/AppKit 编译进应用的具体工程方式：Phase 1 用最小桥接验证，必要时采用 Rust `objc2` 直接包装公开 API。
- macOS 26 台前调度与非激活面板组合行为：Phase 2 实机验证并保留普通浮层降级。
- 当前开发机没有 `rustc/cargo`：开始 Phase 1 前安装 Rust 工具链。

## Sources

### Primary (HIGH confidence)

- https://v2.tauri.app/start/prerequisites/
- https://v2.tauri.app/plugin/single-instance/
- https://v2.tauri.app/plugin/updater/
- https://developer.apple.com/documentation/appkit/nspanel
- https://developer.apple.com/documentation/appkit/nsglasseffectview
- https://developer.apple.com/documentation/quicklookui/qlpreviewview
- https://developer.apple.com/documentation/appkit/nsevent/addglobalmonitorforevents(matching:handler:)
- https://code.visualstudio.com/docs/editor/codebasics#_hot-exit

### Secondary (MEDIUM confidence)

- https://microsoft.github.io/monaco-editor/typedoc/
- npm registry package metadata for Tauri JS plugins, Svelte, Vite, Monaco and monaco-vim

---
*Research completed: 2026-08-26*
*Ready for roadmap: yes*
