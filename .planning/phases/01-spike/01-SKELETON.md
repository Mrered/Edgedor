# Walking Skeleton — Edgedor

**Phase:** 1
**Generated:** 2026-08-26

## Capability Proven End-to-End

在 macOS 26 Apple Silicon 上，用户可以安装并启动唯一的 Edgedor 实例，在真实 `NSPanel` 承载的 Tauri WebView 中输入 Monaco 文本，并通过 typed show/focus/hide/status 协议完成原生面板往返。

## Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Framework | Tauri 2 + Svelte 5 + TypeScript | 轻量 macOS 壳、Rust 逻辑边界和类型化 WebView 通信符合产品约束。 |
| Editor | Monaco Editor 0.56.x | 直接复用 VS Code 编辑区域内核；本阶段只启用单 model/editor。 |
| Native window | Swift 6.3/AppKit `@MainActor` `NSPanel` owner | 真实跨应用面板、焦点和 Space 行为属于 AppKit，不能由 CSS 伪装。 |
| Data layer | 无数据库；Phase 1 仅使用内存 typed panel status | 本阶段证明窗口/编辑器边界，不提前引入会话恢复或文件持久化。 |
| IPC contract | `PanelAction(show|focus|hide)` 与 `{visible, focused, bridgeReady}` | Rust 管生命周期协议，Swift 管窗口句柄，Svelte 管呈现；避免跨层传正文/路径。 |
| Single instance | 官方 `tauri-plugin-single-instance` Rust crate | 处理启动 race 和第二次启动唤醒，不自建 lockfile/socket。 |
| Build/deployment target | 本机 macOS 26 Apple Silicon，`aarch64-apple-darwin` `.app`/开发 DMG | 先验证可安装启动；公证、公开 Release、Updater 留到 Phase 6。 |
| Directory layout | `src/components`, `src/lib/{editor,tauri}`, `src-tauri`, `native/EdgedorPanel` | 清晰分离内容层、Rust backend 和 AppKit 原生 owner，后续阶段可沿用。 |

## Stack Touched in Phase 1

- [x] 项目脚手架（Tauri 2、Svelte 5、TypeScript、Vite、Rust stable）
- [x] 一个真实 Tauri 内容入口与可运行本地命令 `npm run tauri dev`
- [x] 一个真实原生窗口交互：`NSPanel` show/focus/hide/status round-trip
- [x] UI：可输入 Monaco 编辑器、系统语言 fallback、浅/深色主题
- [x] 单实例：第二次启动唤醒已有 owner，不创建第二窗口
- [x] 部署/开发产物：`aarch64-apple-darwin` `.app` 与开发 DMG，并有实机冒烟记录
- [ ] 数据库读写：不适用于本地桌面 Walking Skeleton；业务数据层留给 Phase 4/5

## Out of Scope (Deferred to Later Slices)

- Phase 2：Command/Option/Control/Shift 精确贴边触发、多显示器热区、动画、窗口层级、Liquid Glass 完整工具栏。
- Phase 3：VS Code/Sublime/JetBrains/Vim 键位、命令面板、多标签、编辑组拆分和完整编辑器设置。
- Phase 4：Hot Exit、版本化快照、24 小时过期、撤销关闭槽和无痕开关。
- Phase 5：真实文件读写、编码保真、拖放/剪贴板文件、Finder 打开方式和 Quick Look。
- Phase 6：菜单栏/Dock、登录启动、DMG Release、公证、GitHub Actions、Updater 签名与更新。
- 账号、云同步、遥测、崩溃报告、语言服务器、AI 和工作区。

## Subsequent Slice Plan

- Phase 2：在不改变 Rust/Svelte/NSPanel 边界的前提下加入精确修饰键、多显示器贴边呼出和面板工具栏。
- Phase 3：在现有 Monaco service 上加入编辑区域命令、键位方案和布局操作。
- Phase 4：在 Rust session 边界加入标签、编辑组、恢复快照、寿命和撤销槽。
- Phase 5：在 typed 文件命令边界加入编码保真保存、拖放/剪贴板和 Quick Look。
- Phase 6：在现有 arm64 bundling 入口上加入菜单栏/Dock、公开 Release、签名 updater 和 CI。

## Failure Recording Contract

Swift 静态桥接若无法稳定编译或无法让真实 WebView 进入 `NSPanel`，必须在 `native/EdgedorPanel/BRIDGE-RESULT.md` 写明：失败命令与 stderr、失败阶段、已验证事实、公开 `objc2`/AppKit bridge 的替代边界，以及仍阻塞的验收项。普通 CSS 或普通 Tauri WebView 窗口不能替代该能力，也不能把 Phase 1 标记为成功。
