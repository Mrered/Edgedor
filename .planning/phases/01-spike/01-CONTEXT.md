# Phase 1: 基础与原生面板 Spike - Context

**Gathered:** 2026-08-26
**Status:** Ready for planning
**Source:** 已确认的产品决策与 Phase 1 路线图

<domain>
## Phase Boundary

本阶段只交付可安装、可启动的 Edgedor 基础工作台，并证明 Tauri/Svelte/Monaco 与 macOS 原生 `NSPanel` 的桥接可行。用户能看到一个单实例、单窗口、可输入的 Monaco 编辑区；不在本阶段实现完整贴边触发、标签生命周期、文件 I/O、Quick Look、自动更新或完整快捷键方案。

</domain>

<decisions>
## Implementation Decisions

### Runtime and Platform

- 使用 Tauri 2 + Svelte 5 + TypeScript + Monaco Editor。
- Rust 是应用逻辑边界；原生 macOS 能力使用 Swift/AppKit 或等价公开 AppKit bridge。
- 只支持 macOS 26 Tahoe 和 Apple Silicon；当前目标机是 macOS 26.5.2、Xcode 26.6、Swift 6.3.3。
- 当前机器没有可用的 `rustc/cargo`，Phase 1 需要先安装 Rust stable/rustup。

### Window Spike

- 应用严格单实例、单窗口。
- 面板最终需要覆盖当前工作、支持聚焦和后续左右滑出；Phase 1 先证明原生 `NSPanel` 能显示、聚焦、隐藏，并能承载 Tauri/Svelte 工作台。
- 不用 CSS 假装全局窗口作为最终方案；如果 Swift 静态桥接在本阶段证明成本过高，记录并采用公开 `objc2`/AppKit bridge 的最小替代，但不得退回纯 Web 窗口而不记录风险。

### Editor Baseline

- Monaco 先以一个可输入编辑器实例运行，配置高对比编辑区和 macOS 系统等宽字体。
- 本阶段只验证编辑器能加载、输入和响应基本焦点；具体 VS Code/Sublime/JetBrains/Vim 键位在 Phase 3。
- UI 外壳预留 Liquid Glass 工具栏挂载区域，但不在本阶段完成完整视觉合同。

### Persistence and Scope Fence

- 本阶段可使用最小设置/开发配置，但不实现标签快照、Hot Exit、24 小时寿命和真实文件保存。
- 不引入账号、云同步、遥测或工作区。

### Verification

- 按用户选择，以编译检查和人工冒烟为主，不建设完整自动测试套件。
- 必须在目标 macOS 26 Apple Silicon 机器上确认：DMG/应用启动、单实例、面板显示/聚焦/隐藏、WebView 与 Monaco 交互。

### Claude's Discretion

- Tauri 项目模板细节、Vite 配置和前端目录命名。
- Swift/AppKit bridge 的最小工程组织，只要不复制业务状态并能在后续阶段扩展。
- Phase 1 的开发版 DMG 是否先采用 `tauri build` 产物或本地 `.app` 包装。

</decisions>

<canonical_refs>
## Canonical References

### Product and requirements
- `.planning/PROJECT.md` — Edgedor 产品边界、技术约束和交互合同。
- `.planning/REQUIREMENTS.md` — FOUND-01..04 与全量 v1 需求。
- `.planning/ROADMAP.md` — Phase 1 目标、依赖和成功标准。

### Technical research
- `.planning/research/STACK.md` — Tauri/Svelte/Monaco/AppKit 技术栈与版本核验。
- `.planning/research/ARCHITECTURE.md` — Native bridge、Rust session 和 Svelte/Monaco 边界。
- `.planning/research/PITFALLS.md` — NSPanel、权限、坐标和恢复边界风险。

</canonical_refs>

<specifics>
## Specific Ideas

- 产品名为 Edgedor。
- 未来面板从屏幕侧边呼出，但 Phase 1 先验证窗口基础，不提前实现所有边缘逻辑。
- 用户希望阶段小步提交；Phase 1 每个主题独立 commit，保持随时可回退和可运行。

</specifics>

<deferred>
## Deferred Ideas

- Phase 2：修饰键贴边、多显示器、动画、层级和 Liquid Glass 工具栏。
- Phase 3：编辑区域快捷键方案、命令面板、多标签和拆分。
- Phase 4：Hot Exit、寿命、撤销槽和无痕开关。
- Phase 5：文件、编码、拖放、Finder 和 Quick Look。
- Phase 6：菜单栏/Dock 设置、DMG Release、GitHub Actions 和 Tauri Updater。

</deferred>

---

*Phase: 01-spike*
*Context gathered: 2026-08-26 from confirmed product decisions*
