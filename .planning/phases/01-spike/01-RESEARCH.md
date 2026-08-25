# Phase 1：基础与原生面板 Spike - Research

**Researched:** 2026-08-26  
**Domain:** Tauri 2 + Svelte 5 + Monaco 的 macOS 26 Apple Silicon 应用壳、单实例和 NSPanel 原生桥接  
**Confidence:** MEDIUM

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

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

### Deferred Ideas (OUT OF SCOPE)

## Deferred Ideas

- Phase 2：修饰键贴边、多显示器、动画、层级和 Liquid Glass 工具栏。
- Phase 3：编辑区域快捷键方案、命令面板、多标签和拆分。
- Phase 4：Hot Exit、寿命、撤销槽和无痕开关。
- Phase 5：文件、编码、拖放、Finder 和 Quick Look。
- Phase 6：菜单栏/Dock 设置、DMG Release、GitHub Actions 和 Tauri Updater。
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FOUND-01 | 用户可以安装并启动 Apple Silicon 版本的 Edgedor DMG。 | Tauri macOS prerequisites、`aarch64-apple-darwin` 构建与 `tauri build` 本地 DMG/应用验收路径。 |
| FOUND-02 | Edgedor 只运行一个应用实例和一个侧边窗口。 | Rust 侧 single-instance 插件在启动时拦截第二实例，并将参数/事件交给已有实例；NSPanel 由单一 native owner 持有。 |
| FOUND-03 | 应用界面使用 macOS 系统语言，在简体中文和英文之间自动切换。 | Svelte 文案使用系统 locale 映射；Phase 1 只需中英文最小壳，不引入完整国际化框架。 |
| FOUND-04 | 应用外观跟随 macOS 浅色/深色模式，编辑器使用可读的等宽编辑区。 | WebView 监听 `prefers-color-scheme`，Monaco 明/暗主题显式设置高对比色与 SF Mono；原生面板使用 semantic `NSColor`。 |
</phase_requirements>

## Summary

Phase 1 应先用官方 Tauri 2 Svelte/TypeScript 模板建立最小可运行壳，再以一个 Monaco `ITextModel` 和一个编辑器实例证明输入、焦点及明暗主题，不应提前引入标签、文件或恢复模型。Tauri 的 Rust 应用入口、WebView 内容层和 macOS 原生窗口 owner 应保持清晰边界：Rust 负责生命周期/单实例命令，Svelte 负责内容，原生层负责 `NSPanel` 的窗口行为；业务状态不能复制到 Swift。

原生 Spike 的验收对象是“真实 `NSPanel` 承载 Tauri WebView”，而不是 CSS 贴边窗口。优先做 Swift/AppKit 小型桥接（从 Tauri macOS runner 获取 `NSWindow`/WebView，或由 native owner 创建并嵌入 WebView），用最小 command/event 验证 show/focus/hide/status round-trip。若 Swift 静态桥接在当前 Tauri 模板中无法以低成本稳定编译，再选择公开 `objc2` AppKit bridge，并记录为何降级；不得把普通 Web 窗口当作完成结果。

当前机器的 Node 26.7.0、npm 11.19.0、Xcode 26.6 和 Swift 6.3.3 可用，但没有 `rustc`、`cargo` 或 `rustup`。因此计划第一波必须是安装 Rust stable/rustup、加入 `aarch64-apple-darwin` target，随后才运行 Tauri CLI、开发构建和 DMG。Phase 1 的 DMG 是开发版安装冒烟，不承诺公证或 updater 签名。

**Primary recommendation:** 先安装 Rust stable，使用 Tauri 2 Svelte/TypeScript 模板锁定依赖；以 Rust single-instance + Swift/AppKit `NSPanel` owner + Tauri WebView 内容层实现最小 Spike，并在目标 macOS 26 arm64 上用 `tauri build` 产物做人工冒烟。

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Tauri 启动、单实例生命周期 | API / Backend（Rust） | macOS 原生 | Rust 是应用逻辑边界；原生层只把第二实例请求转发到已有 owner。 |
| `NSPanel` 显示/聚焦/隐藏和层级 | Frontend Server（macOS 原生） | API / Backend（Rust） | AppKit 才能控制 panel style、collection behavior 和 key window；Rust 仅调用 typed command/event。 |
| WebView 与 Monaco 内容 | Browser / Client | Frontend Server（Tauri WebView） | Monaco 与主题、焦点、文本输入运行在 WebView；原生 panel 提供宿主。 |
| 单窗口状态 round-trip | API / Backend（Rust） | Browser / Client | Rust 维护布尔状态/事件协议，Svelte 只渲染桥接状态。 |
| DMG/app 构建 | CDN / Static | API / Backend | Tauri bundler 产生 arm64 安装产物；不在应用代码中实现安装器。 |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@tauri-apps/cli` | 2.11.4 `[VERIFIED: npm registry]` | 初始化、开发和 macOS bundling | npm registry 当前版本；官方 Tauri prerequisites/build 文档。 |
| `@tauri-apps/api` | 2.11.1 `[VERIFIED: npm registry]` | 前端 invoke/event 与窗口 API | 与 Tauri 2 CLI 同代，官方 API 包。 |
| Svelte | 5.56.10 `[VERIFIED: npm registry]` | 最小内容 UI | registry 当前版本；模板可直接配合 Vite。 |
| TypeScript | 7.0.2 `[VERIFIED: npm registry]` | 前端类型边界 | registry 当前版本；Tauri/Svelte/Monaco 类型消费。 |
| `monaco-editor` | 0.56.0 `[VERIFIED: npm registry]` | 一个可输入的编辑器与语言模型 | 官方 Monaco API/typedoc；Phase 1 仅启用基础编辑。 |
| Vite | 8.2.2 `[VERIFIED: npm registry]` | Svelte 开发服务器和 production assets | registry 当前版本；Tauri Svelte 模板构建链。 |
| Rust stable + `aarch64-apple-darwin` | 未安装 `[ASSUMED]` 目标 toolchain 通道 | Tauri 应用逻辑和 arm64 编译 | Tauri 官方 macOS 前置路径要求 Rust；版本在安装时锁定。 |
| Swift 6.3.3 / Xcode 26.6 | 当前机实测 `[VERIFIED: xcodebuild/swift]` | `NSPanel`/AppKit bridge | 当前目标 SDK 为 macOS 26.5，arm64 deployment target。 |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `tauri-plugin-single-instance` Rust crate | 与 Tauri 2 同代，安装时锁定 `[CITED: https://v2.tauri.app/plugin/single-instance/]` | 第二实例拦截和参数回传 | Phase 1 必须启用；它不是 npm 包。 |
| `objc2` / `objc2-app-kit` Rust crates | 仅 Swift bridge 失败时 `[ASSUMED]` | 公开 Objective-C runtime/AppKit bridge | 仅作为记录风险后的 fallback，不与 Swift 路线并行实现。 |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Swift/AppKit static bridge | `objc2`/`objc2-app-kit` | Rust-only bridge 可少一个 Swift target，但 unsafe/SDK API 映射更复杂；仅在 Swift 静态桥接受阻时选。 |
| Tauri Svelte 模板 | 手工 Vite + Rust 壳 | 手工搭建容易漏 capabilities、asset protocol 或 dev URL；只在模板与 macOS bridge 冲突时保留最小手工壳。 |
| `tauri-plugin-single-instance` Rust crate | 自建 lockfile/Unix socket | 自建方案需处理 race、前台激活和 open-with 参数；Phase 1 不应手写。 |

**Installation:**

```bash
# 先安装 Rust（当前机器缺失）
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup default stable
rustup target add aarch64-apple-darwin

# 由 Tauri Svelte 模板生成后，在项目内安装
npm install
npm install monaco-editor
# single-instance 通过 Cargo/Rust 依赖安装，不要寻找同名 npm 包
```

**Version verification:** 2026-08-26 实测 `npm view`：Tauri CLI 2.11.4、API 2.11.1、Svelte 5.56.10、TypeScript 7.0.2、Monaco 0.56.0、Vite 8.2.2；`tauri-plugin-single-instance` 和 `@tauri-apps/plugin-single-instance` 均返回 npm 404，不能写入 `package.json`。

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `@tauri-apps/cli` | npm | 由官方 Tauri 仓库维护 | 未单独采集 | github.com/tauri-apps/tauri | 未完成：slopcheck 0.6.1 CLI 不支持 `--json` 且安装检查超时 | `[ASSUMED]`，规划时再人工核验 |
| `@tauri-apps/api` | npm | 由官方 Tauri 仓库维护 | 未单独采集 | github.com/tauri-apps/tauri | 同上 | `[ASSUMED]`，规划时再人工核验 |
| `svelte` | npm | 2019 起可追溯版本 | 未单独采集 | github.com/sveltejs/svelte | 同上 | `[ASSUMED]`，规划时再人工核验 |
| `typescript` | npm | 2014 起可追溯版本 | 未单独采集 | github.com/microsoft/TypeScript | 同上 | `[ASSUMED]`，规划时再人工核验 |
| `monaco-editor` | npm | 2016 起可追溯版本 | 未单独采集 | github.com/microsoft/monaco-editor | 同上 | `[ASSUMED]`，规划时再人工核验 |
| `vite` | npm | 2019 起可追溯版本 | 未单独采集 | github.com/vitejs/vite | 同上 | `[ASSUMED]`，规划时再人工核验 |
| `tauri-plugin-single-instance` | npm | 不存在 | — | — | N/A | **REMOVED**；只使用官方文档对应 Rust crate |

**Packages removed due to slopcheck [SLOP] verdict:** `tauri-plugin-single-instance` 的 npm 名称因 registry 404 移除；不是 slopcheck SLOP，而是错误生态名称。  
**Packages flagged as suspicious [SUS]:** 无；slopcheck JSON 模式不可用，所有 npm 包都保留 `[ASSUMED]`，planner 必须在安装前加 `checkpoint:human-verify`。

## Architecture Patterns

### System Architecture Diagram

```text
启动入口 / 第二次启动
        │
        ▼
Rust Tauri runtime ── single-instance plugin ──┐
        │                                       │ second-instance args/event
        │ typed invoke/event                    ▼
        ▼                              existing native owner
Svelte 5 + Monaco WebView  ◄──────► Swift/AppKit NSPanel
        │ focus/theme/status                  │ show/focus/hide
        ▼                                     ▼
  editable text surface              macOS 26 window manager
        │
        ▼
Tauri bundler → arm64 `.app` / development DMG
```

### Recommended Project Structure

```text
src/
├── lib/tauri/       # typed invoke/event wrappers
├── lib/editor/      # Monaco creation, theme, focus
├── components/      # editor + toolbar mount slot + status
└── app.html
src-tauri/
├── src/lib.rs       # builder, single-instance, commands/events
├── capabilities/    # only required Tauri permissions
└── Cargo.toml
native/
└── EdgedorPanel/    # minimal Swift/AppKit owner/bridge (if needed)
```

### Pattern 1: One Native Owner, One WebView

**What:** 启动时只创建一个 `NSPanel` owner；Tauri WebView 是其 content view 或被现有 Tauri `NSWindow` 嵌入的内容层。show/focus/hide 由 native owner 执行，状态通过 typed event 回传。  
**When to use:** 本阶段的 panel Spike 以及后续贴边/层级功能。  
**Example:** Swift 创建 `NSPanel(styleMask: [.titled, .closable, .resizable, .nonactivatingPanel])`，设置 `isFloatingPanel`/`collectionBehavior` 的最小组合；Rust 命令只发送 `panel.show`、`panel.hide`、`panel.focus`，不在 Swift 保存业务 tab 状态。  
**Source:** `[CITED: https://developer.apple.com/documentation/appkit/nspanel]`、`[CITED: https://v2.tauri.app/develop/calling-rust/]`。

### Pattern 2: Typed Command/Event Round-trip

**What:** Svelte 调 `invoke('panel_status')` 或发送 `panel_action`；Rust/Swift 只返回 `{visible, focused, bridgeReady}`，而不是任意 native object/path。  
**When to use:** 验证 WebView 能收发原生状态且第二实例不会创建新窗口。  
**Source:** `[CITED: https://v2.tauri.app/develop/calling-rust/]`、`[CITED: https://v2.tauri.app/develop/calling-frontend/]`。

### Pattern 3: Monaco Single-model Baseline

**What:** 在 `onMount` 创建一个 `monaco.editor.create` 实例，使用单一模型、固定 `fontFamily` 为系统等宽字体，并在桥接 ready 后显式 `editor.focus()`；组件销毁时 dispose。  
**When to use:** Phase 1 只证明加载/输入/焦点，不提前实现模型 registry、标签或持久化。  
**Source:** `[CITED: https://microsoft.github.io/monaco-editor/typedoc/functions/editor.create.html]`。

### Anti-Patterns to Avoid

- **CSS 伪全局窗口：** 浏览器层无法可靠覆盖其他应用、全屏空间或控制 AppKit 层级；保留原生 `NSPanel` Spike。 `[CITED: https://developer.apple.com/documentation/appkit/nspanel]`
- **重复创建 Tauri 窗口：** 第二实例应交给 single-instance 插件和已有 owner，而不是创建第二个 WebviewWindow。 `[CITED: https://v2.tauri.app/plugin/single-instance/]`
- **把 Swift 当业务 store：** Swift 仅持有窗口句柄与短暂桥接状态，Rust/Svelte 才是后续业务边界。
- **错误 npm 单实例包名：** npm registry 对两个 scoped/unscoped 名称均 404；不要把 Rust crate 当 JavaScript 包安装。 `[VERIFIED: npm registry]`

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 单实例锁与第二次启动参数 | 自定义 lockfile/socket | Tauri 官方 single-instance Rust plugin | 已处理启动 race、参数回传和现有实例通知。 |
| Monaco 编辑器内核 | 自制 textarea/快捷键/语法高亮 | `monaco-editor` | 编辑器行为、模型和 worker 边界复杂，Phase 1 只需最小实例。 |
| DMG 目录/签名布局 | 手工 `hdiutil` 脚本作为主流程 | Tauri bundler 的 macOS `.dmg` 目标 | 统一 app bundle 资源和后续 CI 入口；本阶段不做公证。 |
| AppKit 窗口层级 | Web CSS `position: fixed` | `NSPanel` | 跨应用、焦点和 Space 行为属于 AppKit。 |

**Key insight:** Phase 1 的价值在于尽早验证最容易推翻后续架构的 native/WebView 边界；任何把这条边界隐藏在 CSS、重复窗口或自定义编辑器中的捷径都会制造后续重写。

## Common Pitfalls

### Pitfall 1：Rust 缺失导致“模板能看、Tauri 不能构建”

**What goes wrong:** npm/Vite 可启动，但 `cargo`/Tauri build 在 macOS bundling 前失败。  
**Why it happens:** 当前机器没有 `rustc/cargo/rustup`。  
**How to avoid:** Wave 0 安装 rustup stable、`aarch64-apple-darwin` target，并记录 `rustc -Vv`、`cargo -V`。  
**Warning signs:** `command not found: cargo`、无法解析 Rust dependencies。

### Pitfall 2：Swift bridge 绑定到错误的 Tauri window 生命周期

**What goes wrong:** native panel 显示但 WebView 空白、重复创建或关闭后悬挂。  
**Why it happens:** `NSWindow`/WebView owner 和 Rust app handle 不唯一，或在非主线程操作 AppKit。  
**How to avoid:** native owner 在主线程创建/销毁；只保存一个 panel 引用；桥接 ready 后再允许 focus/show；失败时以状态事件明确显示。  
**Warning signs:** 窗口可见但输入无效、第二次启动出现第二面板、退出崩溃。

### Pitfall 3：把成功定义成普通 Tauri 窗口

**What goes wrong:** Demo 可输入，但无法证明后续 `NSPanel` 的层级/焦点路径。  
**How to avoid:** 验收记录必须包含真实 NSPanel 的 show/focus/hide 和 WebView round-trip；若 fallback 到 `objc2`，写清楚风险和下一阶段阻塞点。

### Pitfall 4：主题/语言只在启动时硬编码

**What goes wrong:** 仅中文或仅浅色，切换 macOS 设置后壳与编辑器不一致。  
**How to avoid:** Svelte 使用系统 locale 的 `zh-Hans`/英文 fallback 映射，监听 `matchMedia('(prefers-color-scheme: dark)')`，Monaco 明暗 theme 显式切换；无须引入完整 i18n 包。

### Pitfall 5：DMG 冒烟被误报为发布完成

**What goes wrong:** 本地开发 DMG 可启动，却没有公证、更新签名或 Release 元数据。  
**How to avoid:** Phase 1 只验安装/启动/单实例；签名 updater 与公开 Release 留到 Phase 6，记录未公证 Gatekeeper 提示。

## Code Examples

### Tauri single-instance registration

```rust
// Pattern only; exact crate API must follow installed Tauri 2 crate docs.
tauri::Builder::default()
    .plugin(tauri_plugin_single_instance::init(|app, argv, cwd| {
        // notify existing owner; do not create a second window
        let _ = (app, argv, cwd);
    }))
    .run(tauri::generate_context!())?;
```

**Source:** `[CITED: https://v2.tauri.app/plugin/single-instance/]`。这是计划级模式示例，不应在未安装 crate 前照抄 API。

### Monaco baseline

```ts
const model = monaco.editor.createModel('', 'plaintext');
const editor = monaco.editor.create(container, {
  model,
  theme: prefersDark ? 'edgedor-dark' : 'edgedor-light',
  fontFamily: 'SF Mono, Menlo, monospace',
  fontSize: 14,
  automaticLayout: true,
});
editor.focus();
```

**Source:** `[CITED: https://microsoft.github.io/monaco-editor/typedoc/functions/editor.create.html]`。

### Swift/AppKit panel boundary

```swift
@MainActor
final class PanelOwner {
    private var panel: NSPanel?

    func show(contentView: NSView) {
        let panel = NSPanel(
            contentRect: .zero,
            styleMask: [.titled, .resizable],
            backing: .buffered,
            defer: false
        )
        panel.contentView = contentView
        panel.makeKeyAndOrderFront(nil)
        self.panel = panel
    }
}
```

**Source:** `[CITED: https://developer.apple.com/documentation/appkit/nspanel]`。实际 style mask、collection behavior 和 Tauri WebView 注入方式必须在 macOS 26 实机 Spike 中确定。

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Tauri 1 / WebViewWindow-only | Tauri 2 + plugin/command/event boundary | Tauri 2 documentation `[CITED: https://v2.tauri.app/]` | 新项目使用 Tauri 2 API 与 capabilities，不能混用旧插件配置。 |
| CSS 固定侧边栏 | AppKit `NSPanel` 宿主 + WebView 内容 | Phase 1 product decision | 后续可覆盖全屏/Space，并保留原生层级控制。 |
| 手写编辑 textarea | Monaco `ITextModel` + `editor.create` | Monaco API stable pattern | 为 Phase 3 编辑命令留下正确模型边界。 |

**Deprecated/outdated:** 不使用 Tauri 1 plugin 配置、Electron 壳、或把 `tauri-plugin-single-instance` 作为 npm dependency；npm registry 已证实后者不存在。

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | Svelte/Vite/Monaco | ✓ | 26.7.0 | — |
| npm | JS dependencies | ✓ | 11.19.0 | — |
| Xcode / macOS SDK | Swift bridge、Tauri macOS build | ✓ | Xcode 26.6 / macOS SDK 26.5 | — |
| Swift | AppKit bridge | ✓ | 6.3.3, target arm64 macOS 26 | — |
| Rust toolchain | Tauri commands/build | ✗ | `rustc/cargo/rustup` 缺失 | 安装 rustup stable；无可接受代码 fallback |
| `aarch64-apple-darwin` target | Apple Silicon DMG | ✗（Rust 未安装） | — | Rust 安装后 `rustup target add` |
| Context7/`ctx7` | 文档检索 | ✗ | 未安装 | 使用已核验官方 docs URL 和 registry 命令 |

**Missing dependencies with no fallback:** Rust stable/rustup 是执行阻塞项，必须作为 Wave 0 安装任务。

## Validation Architecture

`.planning/config.json` 将 `workflow.nyquist_validation` 明确设为 `false`，因此本阶段不建设自动测试套件；验证采用编译检查和人工冒烟。

### Manual verification map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|---------|----------|-----------|-------------------|--------------|
| FOUND-01 | 安装并启动 arm64 DMG/app | manual smoke | `file target/release/bundle/macos/*.app/Contents/MacOS/*` + Finder launch | Wave 0 build artifact |
| FOUND-02 | 重复启动只保留一个实例和 panel | manual smoke | `pgrep -fl Edgedor`（辅助证据） | Wave 0 app |
| FOUND-03 | 简中/英文与明暗模式跟随系统 | manual smoke | 系统设置切换后重启/显示面板 | Wave 0 UI |
| FOUND-04 | Monaco 输入、焦点、可读主题 | manual smoke | `npm run build` + 实机输入 | Wave 0 UI |
| panel spike | NSPanel show/focus/hide 和 WebView status round-trip | manual smoke | `cargo tauri dev` + 实机点击/键盘 | Native bridge files created by plan |

### Sampling Rate

- **Per task commit:** `npm run build`（前端）或 `cargo check`（Rust/native wiring）。
- **Per wave merge:** `cargo tauri build --target aarch64-apple-darwin`（目标机）。
- **Phase gate:** arm64 DMG/app 安装后完成人工冒烟，不能以编译绿代替 NSPanel 验证。

### Wave 0 Gaps

- [ ] 安装 Rust stable/rustup 和 `aarch64-apple-darwin` target。
- [ ] 创建 Tauri 2 Svelte 5 TypeScript 模板、锁文件和最小 capabilities。
- [ ] 选择并验证 Swift static bridge 的工程接入点；若失败，再建立 `objc2` fallback spike。
- [ ] 生成开发 DMG 或 `.app`，并保存人工冒烟记录（不宣称公证/Release）。

## Security Domain

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | 无账号；不引入认证。 |
| V3 Session Management | no | Phase 1 不做恢复会话。 |
| V4 Access Control | yes | Tauri capabilities 只开放必需 command/window 权限。 |
| V5 Input Validation | yes | IPC command 使用固定 enum/结构，不接受任意 shell/path；Monaco 内容仅内存。 |
| V6 Cryptography | no | Phase 1 不存恢复数据、不实现加密；不得伪造安全承诺。 |

### Known Threat Patterns for Tauri/macOS

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| 任意 WebView command 被调用 | Tampering/Elevation | capabilities 最小化、Rust command 参数强类型和白名单。 |
| 第二实例绕过单实例约束 | Spoofing/Tampering | 官方 single-instance plugin；启动测试同时观察进程数和窗口数。 |
| 原生 bridge 在后台线程触碰 AppKit | Denial of Service | `@MainActor`/main queue 统一创建、显示、隐藏和释放 `NSPanel`。 |
| 调试构建泄露路径/内容 | Information disclosure | Spike 状态事件只发枚举/布尔值，不打印编辑正文、路径或凭证。 |

## Don't Miss / Open Questions

1. **Tauri WebView 应由谁拥有？** 当前应先让模板默认 `NSWindow` 跑通，再把该窗口嵌入/包装进唯一 `NSPanel`；不同 Tauri 2 runner 接入点可能不同。计划必须把“最小 bridge feasibility”设为显式任务和失败记录点，而不是假设 API。
2. **Swift 静态库还是 objc2？** 锁定 Swift/AppKit 优先；只有 Swift target 接入成本/编译稳定性不达标时才用公开 objc2，并保留后续迁移风险。两者都不要在 Phase 1 同时维护。
3. **开发 DMG 是否需要签名？** 本阶段只需本地可安装 arm64 产物；未公证 Gatekeeper 提示属于预期，签名 updater/Release 是 Phase 6。

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Rust stable 安装后可直接为当前 macOS 26.5 SDK 编译 Tauri arm64 目标。 | Standard Stack/Environment | 可能需锁定特定 Rust/Xcode 组合，阻塞构建。 |
| A2 | Tauri 2 模板可在不复制业务状态的前提下承载由 Swift owner 管理的 `NSPanel`。 | Summary/Architecture | 若 runner 生命周期不兼容，需改用 objc2 或延后 panel owner。 |
| A3 | TypeScript 7.0.2 与 Tauri/Svelte 模板当前插件组合兼容。 | Standard Stack | 版本过新可能需要锁定模板 peer 依赖。 |
| A4 | `objc2`/`objc2-app-kit` 的当前 crate API 足以替代 Swift bridge。 | Supporting | 未在本会话检索 crate docs，使用前必须官方文档核验。 |
| A5 | 预览 DMG 可通过 `tauri build` 直接产生足够的开发安装产物。 | Summary/Validation | bundler 目标/签名配置可能要求额外 plist 或证书设置。 |

## Sources

### Primary (HIGH confidence)

- [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) — macOS/Xcode/Rust 前置条件。
- [Tauri single instance](https://v2.tauri.app/plugin/single-instance/) — 官方单实例 Rust plugin 语义。
- [Tauri calling Rust](https://v2.tauri.app/develop/calling-rust/) — 前端到 Rust command 边界。
- [Tauri calling frontend](https://v2.tauri.app/develop/calling-frontend/) — Rust 到前端 event 边界。
- [Apple NSPanel](https://developer.apple.com/documentation/appkit/nspanel) — 原生辅助面板 API。
- [Apple NSGlassEffectView](https://developer.apple.com/documentation/appkit/nsglasseffectview) — macOS 26 Liquid Glass 公开入口；Phase 1 仅预留挂载位。
- [Monaco `editor.create`](https://microsoft.github.io/monaco-editor/typedoc/functions/editor.create.html) — 编辑器实例 API。

### Secondary (MEDIUM confidence)

- `.planning/research/STACK.md`、`.planning/research/ARCHITECTURE.md`、`.planning/research/PITFALLS.md` — 项目已整理的技术边界和风险；与官方入口交叉核对。
- `npm view` registry 查询（2026-08-26）— 版本/仓库元数据；版本可漂移，执行时以锁文件为准。

### Tertiary (LOW confidence)

- 本会话未使用 WebSearch/Context7；`ctx7` 不可用，因此 objc2 fallback 的具体 API 未验证，见 A4。

## Project Constraints (from AGENTS.md)

- 所有用户可见回复、规划文档摘要和工作流输出使用简体中文。
- 遵守 Tauri 2 + Svelte 5 + TypeScript + Monaco、macOS 26 Apple Silicon、Rust/AppKit 分层、单实例单窗口等项目约束。
- Phase 1 质量策略是编译检查和人工冒烟，不建设完整自动测试体系。
- GSD 研究文档写入 `.planning/phases/01-spike/01-RESEARCH.md`；不要把本研究扩展为 Phase 2–6 实现。

## Metadata

**Confidence breakdown:**
- Standard stack: MEDIUM — npm/Xcode/toolchain 当前版本已实测，Rust crate 与 Swift bridge 细节仍需在目标机编译验证。
- Architecture: MEDIUM — Tauri/AppKit/Monaco 官方边界明确，但具体 WebView 注入/owner 接入点是 Spike 未决事项。
- Pitfalls: HIGH/MEDIUM — Rust 缺失、错误 npm 包名和 scope fence 已实测；原生窗口行为需实机确认。

**Research date:** 2026-08-26  
**Valid until:** 2026-09-25（Tauri/Svelte/Monaco 版本变化较快，执行前重新核验 registry 与官方 docs）
