# Phase 1：基础与原生面板 Spike - 模式映射

**映射日期：** 2026-08-26  
**分析文件：** 0 个源代码文件（绿地仓库）  
**Analog：** 0 / 预期 14 个实现文件  

本仓库当前除 `AGENTS.md` 与 `.planning/` 文档外没有应用源码、测试、配置或原生工程。因此不存在可复用的本地实现模式；以下映射以 Phase 1 的研究结论和 UI 合同作为首批文件的“规范 analog”。后续阶段应把稳定实现回填为新的 analog，而不要复制本阶段的临时 Spike 代码。

## 文件分类

| 新建文件 | 角色 | 数据流 | 预期目录/边界 | Closest Analog | 匹配质量 |
|---|---|---|---|---|---|
| `package.json` | config | 构建/依赖 | 根目录，Node/Vite/Tauri 前端依赖 | 无；采用 Tauri Svelte 模板 | 无 analog |
| `vite.config.ts` | config | 构建/transform | 根目录，Svelte/Vite 与 Monaco worker | 无；采用官方模板 | 无 analog |
| `src/app.html` | component shell | request-response | WebView HTML 宿主 | 无 | 无 analog |
| `src/main.ts` | entry/controller | request-response | 前端启动、挂载 `App.svelte` | 无 | 无 analog |
| `src/App.svelte` | component | request-response | 内容层编排、语言/主题与桥接状态 | 无 | 无 analog |
| `src/lib/tauri/panel.ts` | utility/API wrapper | request-response | typed `invoke`/event 封装 | 无 | 无 analog |
| `src/lib/editor/monaco.ts` | utility/service | transform | Monaco model/editor、theme、focus、dispose | 无 | 无 analog |
| `src/components/EditorSurface.svelte` | component | transform | 单一可输入 Monaco surface | 无 | 无 analog |
| `src/components/ToolbarMount.svelte` | component | request-response | Liquid Glass 工具栏挂载位与状态反馈 | 无 | 无 analog |
| `src-tauri/Cargo.toml` | config | 构建/依赖 | Rust/Tauri 与 single-instance crate | 无 | 无 analog |
| `src-tauri/src/lib.rs` | controller/backend | request-response + event-driven | builder、单实例、typed commands/events | 无 | 无 analog |
| `src-tauri/capabilities/default.json` | config/security | request-response | 最小 Tauri command/window 权限 | 无 | 无 analog |
| `native/EdgedorPanel/PanelOwner.swift` | native controller | request-response | `@MainActor` 的唯一 `NSPanel` owner | 无 | 无 analog |

> `tauri.conf.json`、图标和 Swift target/project 文件属于模板或构建配套文件；若计划显式创建，应分别沿 config/build 角色处理，不要把窗口业务放进配置文件。

## 模式分配

### `src-tauri/src/lib.rs`（backend/controller，request-response + event-driven）

**规范来源：** `.planning/phases/01-spike/01-RESEARCH.md:173-187,189-200,259-271`。

**启动与单实例模式：** 使用 Tauri builder 注册官方 Rust `tauri-plugin-single-instance`。第二次启动回调只通知已有 owner 并请求显示/聚焦，不创建第二个 `WebviewWindow`；具体 crate API 以安装后的 Tauri 2 文档为准。

```rust
tauri::Builder::default()
    .plugin(tauri_plugin_single_instance::init(|app, argv, cwd| {
        // 通知已有 owner；不创建第二窗口
        let _ = (app, argv, cwd);
    }))
    .run(tauri::generate_context!())?;
```

**命令/事件边界：** Rust 只暴露固定 action/status 类型，例如 `panel_action`（show/focus/hide）和 `panel_status`；状态只包含 `{ visible, focused, bridgeReady }` 等布尔/枚举，不传任意 native object、路径或编辑正文。Rust 管理生命周期与协议，Swift 管理窗口句柄，Svelte 负责渲染。

**错误模式：** command 参数强类型、白名单化；capabilities 只开放必需命令。桥接未就绪时返回可渲染的错误状态，不打印正文、路径或凭证。

### `native/EdgedorPanel/PanelOwner.swift`（native controller，request-response）

**规范来源：** `.planning/phases/01-spike/01-RESEARCH.md:189-194,235-245,289-305`。

**唯一 owner 模式：** `@MainActor` 类仅持有一个可选 `NSPanel` 引用；在主线程创建、显示、聚焦、隐藏和释放。面板承载 Tauri WebView/content view，使用最小 `.titled/.resizable`（或研究中的 nonactivating 组合），只设置必要的浮层/Space 行为。

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

Swift 不保存标签、会话或业务状态；只报告 show/focus/hide/bridge-ready 结果。若静态 Swift 接入 Tauri runner 失败，才记录原因并以公开 `objc2` AppKit bridge 替代，不能退回 CSS 或普通 Web 窗口而不记录风险。

### `src/lib/tauri/panel.ts`、`src/App.svelte`（API wrapper/component，request-response）

**规范来源：** `.planning/phases/01-spike/01-RESEARCH.md:196-200` 与 `.planning/phases/01-spike/01-UI-SPEC.md:24-30,91-106`。

封装所有 `invoke`/event 监听，组件只消费类型化状态。初始化时显示加载态，收到 `bridgeReady` 后启用挂载位并聚焦编辑器；错误通过短文案和 `aria-live="assertive"` 暴露，不能遮挡编辑内容。不要让组件直接接触 Swift 对象或任意 IPC payload。

### `src/lib/editor/monaco.ts`、`src/components/EditorSurface.svelte`（editor service/component，transform）

**规范来源：** `.planning/phases/01-spike/01-RESEARCH.md:202-206,273-287`。

使用一个 `ITextModel` 和一个 `monaco.editor.create` 实例；`onMount` 创建，桥接 ready 后显式 `editor.focus()`，组件销毁时 dispose。保持高对比明暗主题、14px `SF Mono, Menlo, monospace`、`automaticLayout: true`，只验证加载、输入和焦点，不预建模型 registry、标签、持久化或 Phase 3 键位层。

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

### `src/components/ToolbarMount.svelte`（component，request-response）

只提供低干扰的 Liquid Glass 工具栏挂载位和桥接状态，不实现完整工具栏、标签、设置或边缘触发。遵循 UI-SPEC：窄宽仍保留 Monaco 至少 280px，控件最小 44px，图标按钮有动作型 accessible name，键盘焦点不抢编辑器。

### `package.json`、`vite.config.ts`、`src-tauri/Cargo.toml`、`capabilities/default.json`（config，build/request-response）

沿官方 Tauri 2 Svelte/TypeScript 模板生成，不手工拼装 WebView、DMG 或单实例锁。前端锁定研究中核验的 Tauri CLI/API、Svelte、TypeScript、Monaco、Vite 版本范围；single-instance 只作为 Rust crate，不安装同名 npm 包。capabilities 采用最小权限，禁止任意 shell/path 能力。DMG 使用 Tauri bundler，Phase 1 不承诺公证、updater 签名或 Release。

## 共享模式

### 单一原生 owner
**应用于：** `src-tauri/src/lib.rs`、`native/EdgedorPanel/PanelOwner.swift`。  
Rust 负责生命周期和 typed commands/events；Swift 在 `@MainActor` 上维护唯一 `NSPanel`；第二实例只唤醒已有 owner。

### Typed IPC 与最小权限
**应用于：** `src/lib/tauri/panel.ts`、`src/App.svelte`、`src-tauri/src/lib.rs`、`src-tauri/capabilities/default.json`。  
固定 enum/结构传递 `visible/focused/bridgeReady`，不传路径、编辑正文或 native object；命令白名单与 capabilities 同步。

### 主题、语言与焦点
**应用于：** `src/App.svelte`、`src/components/*`、`src/lib/editor/monaco.ts`。  
locale 映射为简体中文/英文 fallback；监听 `prefers-color-scheme` 并显式切换 Monaco theme；首次显示与桥接 ready 后聚焦 Monaco。所有状态使用相应 `aria-live`，错误不遮挡文本。

### 验证与提交
**应用于：** 全部 Phase 1 文件。  
每个主题独立小步 commit；前端改动运行 `npm run build`，Rust/native wiring 运行 `cargo check`，每波运行 arm64 `cargo tauri build`。最终必须在 macOS 26 Apple Silicon 实机人工确认安装启动、单实例、NSPanel show/focus/hide、WebView round-trip 与 Monaco 输入；编译通过不能代替原生面板验收。

## 无 Analog

所有 14 个预期实现文件均无本地 analog，原因是仓库是绿地初始化状态，仅存在规划文档。Planner 应以本文件列出的研究代码片段和边界作为初始实现依据，并在后续计划中显式记录 Swift bridge 接入点的可行性/失败记录。

## Phase 1 小步提交建议

1. `chore: bootstrap tauri svelte typescript shell`：Rust toolchain、Tauri/Svelte 模板、锁文件、最小 capabilities。
2. `feat: add monaco editor baseline`：单模型编辑器、主题/语言映射、焦点与 dispose、最小工具栏挂载位。
3. `feat: add single instance commands`：Rust builder、single-instance crate、typed panel status/action 协议。
4. `spike: bridge tauri webview through native panel`：唯一 Swift `PanelOwner`、主线程生命周期和 show/focus/hide round-trip；若失败提交明确 fallback/阻塞记录。
5. `build: verify arm64 development artifact`：Tauri arm64 `.app`/开发 DMG 和人工冒烟记录；不宣称公证或 updater 完成。

## 元数据

**搜索范围：** 仓库全部非 `.git` 路径；结果仅有 `AGENTS.md` 与 `.planning/`。  
**扫描源码文件：** 0。  
**结论：** 本阶段没有可复制的既有代码模式；新代码必须保持 Tauri/Rust、Svelte/Monaco、Swift/AppKit 三层边界。
