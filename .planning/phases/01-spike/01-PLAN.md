---
phase: 01-spike
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - rust-toolchain.toml
  - package.json
  - package-lock.json
  - vite.config.ts
  - src/app.html
  - src/main.ts
  - src/App.svelte
  - src/lib/tauri/panel.ts
  - src/lib/editor/monaco.ts
  - src/components/EditorSurface.svelte
  - src/components/ToolbarMount.svelte
  - src-tauri/Cargo.toml
  - src-tauri/src/lib.rs
  - src-tauri/capabilities/default.json
  - src-tauri/tauri.conf.json
  - native/EdgedorPanel/PanelOwner.swift
  - native/EdgedorPanel/BRIDGE-RESULT.md
  - .planning/phases/01-spike/01-SMOKE.md
autonomous: false
requirements: [FOUND-01, FOUND-02, FOUND-03, FOUND-04]
user_setup: []
must_haves:
  truths:
    - "Apple Silicon 用户可以安装开发版 DMG 并启动 Edgedor，看到可输入的 Monaco 编辑区。"
    - "重复启动不会创建第二个应用实例、第二个 WebView 或第二个 NSPanel。"
    - "界面文案按 macOS 系统语言在简体中文与英文间切换，浅色/深色模式与 Monaco 高对比主题同步。"
    - "真实 NSPanel 承载 Tauri WebView，并完成 show/focus/hide/status 的 typed round-trip。"
  artifacts:
    - path: "src-tauri/src/lib.rs"
      provides: "Tauri builder、single-instance、panel action/status 命令与事件"
      contains: "tauri_plugin_single_instance"
    - path: "native/EdgedorPanel/PanelOwner.swift"
      provides: "@MainActor 唯一 NSPanel owner"
      contains: "NSPanel"
    - path: "src/components/EditorSurface.svelte"
      provides: "单一可输入 Monaco 编辑器"
      contains: "monaco"
    - path: "src/lib/tauri/panel.ts"
      provides: "类型化 invoke/event 边界"
      contains: "panel_status"
    - path: ".planning/phases/01-spike/01-SMOKE.md"
      provides: "arm64 安装、单实例和真实 NSPanel 人工冒烟证据或失败记录"
  key_links:
    - from: "src/components/EditorSurface.svelte"
      to: "src/lib/editor/monaco.ts"
      via: "onMount 创建 model/editor，销毁时 dispose"
      pattern: "editor\.create|dispose"
    - from: "src/App.svelte"
      to: "src/lib/tauri/panel.ts"
      via: "初始化状态并发送 show/focus/hide action"
      pattern: "invoke|listen"
    - from: "src-tauri/src/lib.rs"
      to: "native/EdgedorPanel/PanelOwner.swift"
      via: "typed native bridge action/status"
      pattern: "bridgeReady|panel_action|panel_status"
    - from: "src-tauri/src/lib.rs"
      to: "tauri-plugin-single-instance"
      via: "builder plugin intercepts second launch"
      pattern: "single_instance"
---

<objective>
交付 Phase 1 的 Walking Skeleton：一个可安装启动、严格单实例、可输入 Monaco 的 Tauri/Svelte 应用，并在 macOS 26 Apple Silicon 上证明真实 `NSPanel` 承载 WebView 的 show/focus/hide/status round-trip。

Purpose: 先锁定 Rust、WebView、Monaco 与原生窗口的边界，避免后续贴边触发、会话和文件阶段建立在普通 CSS/WebView 窗口或重复实例之上。
Output: 可运行源码、最小 Swift bridge、arm64 开发版 `.app`/DMG 验收记录；Swift 路线不可行时留下明确失败原因与 `objc2` 替代边界。
</objective>

<execution_context>
@/Users/mrered/.codex/get-shit-done/workflows/execute-plan.md
@/Users/mrered/.codex/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/REQUIREMENTS.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/config.json
@.planning/phases/01-spike/01-CONTEXT.md
@.planning/phases/01-spike/01-RESEARCH.md
@.planning/phases/01-spike/01-PATTERNS.md
@.planning/phases/01-spike/01-UI-SPEC.md

<decision_traceability>
`01-CONTEXT.md` 未给锁定决策编号；为满足执行追踪，本计划使用内部编号：D-01=Runtime and Platform（Tauri/Svelte/Monaco、macOS 26 arm64、Rust stable）；D-02=Window Spike（单实例、真实 NSPanel、不可退回 CSS）；D-03=Editor Baseline（单 Monaco、可输入、主题/焦点）；D-04=Persistence and Scope Fence（不做恢复/文件/账号/遥测）；D-05=Verification（编译检查+目标机人工冒烟）；D-06=Deferred Ideas（Phase 2–6 不进入本计划）。
</decision_traceability>

<interfaces>
从本阶段研究约定的跨层契约：

- 前端 `PanelStatus` 只包含 `visible: boolean`、`focused: boolean`、`bridgeReady: boolean`，不得传编辑正文、路径或 native object。
- 前端 `panelAction(action: "show" | "focus" | "hide")` 调用 Rust typed command；Rust 通过 `panel_status` 事件回传同一状态。
- `PanelOwner` 是 `@MainActor` 类，只持有一个可选 `NSPanel` 引用；Swift 不保存标签/会话业务状态。
- Monaco 只创建一个 `ITextModel` 和一个 editor，使用 `SF Mono, Menlo, monospace`、14px、`automaticLayout: true`；Phase 1 不实现标签、持久化或键位方案。
</interfaces>
</context>

<tasks>

<task type="checkpoint:human-verify" gate="blocking-human">
  <name>Task 0: 通过依赖合法性与本机工具链闸门</name>
  <files>无（依赖合法性与平台确认闸门，不修改源码）</files>
  <action>在任何 npm/Cargo 安装前暂停，核验研究中标记为 `[ASSUMED]` 的包确实来自官方 registry/源仓库，并确认目标平台与 rustup 安装授权；未获确认不得继续安装。</action>
  <what-built>规划已锁定官方 Tauri 2/Svelte/TypeScript/Monaco 依赖和 Apple Silicon 目标；执行者将先核验 registry 来源并准备 Rust stable 工具链。</what-built>
  <how-to-verify>
    1. 在 npmjs.com 核对 `@tauri-apps/cli`、`@tauri-apps/api`、`svelte`、`typescript`、`monaco-editor`、`vite` 均为对应官方仓库包；不要安装不存在的 npm single-instance 包，Rust crate 只从 crates.io/GitHub 官方文档确认。
    2. 确认目标机为 macOS 26 Apple Silicon，Xcode 26.6/Swift 6.3.3 可用；允许执行 rustup stable 安装和 `aarch64-apple-darwin` target 添加。
    3. 确认本阶段不做 Phase 2–6 的贴边触发、完整工具栏、键位方案、多标签/恢复、文件/Quick Look、菜单栏/Dock、Release/updater。
  </how-to-verify>
  <resume-signal>回复“approved”后继续；若包来源或平台条件不符，描述问题。</resume-signal>
  <verify>
    <automated>command -v node && command -v npm && command -v xcodebuild && sw_vers -productVersion</automated>
  </verify>
  <done>用户确认所有待安装包的官方来源、macOS 26 Apple Silicon/Xcode 前置条件和 rustup 安装范围，执行者获准进入脚手架任务。</done>
</task>

<task type="auto" tdd="false">
  <name>Task 1: 建立可运行的 Tauri/Svelte/Monaco 单实例基础切片</name>
  <files>rust-toolchain.toml, package.json, package-lock.json, vite.config.ts, src/app.html, src/main.ts, src/App.svelte, src/lib/tauri/panel.ts, src/lib/editor/monaco.ts, src/components/EditorSurface.svelte, src/components/ToolbarMount.svelte, src-tauri/Cargo.toml, src-tauri/src/lib.rs, src-tauri/capabilities/default.json, src-tauri/tauri.conf.json</files>
  <action>
    先安装 rustup stable、设置默认 stable 并添加 `aarch64-apple-darwin`（按 D-01/Runtime locked decision）；使用官方 Tauri 2 Svelte + TypeScript 模板生成壳，不手工实现 WebView 或 DMG。安装前按 Task 0 闸门核验 `[ASSUMED]` npm 包来源；`tauri-plugin-single-instance` 只加入 Rust Cargo 依赖，禁止写入 npm。实现一个真实端到端基础切片：Tauri 启动后仅创建一个窗口，Svelte 渲染中英文最小空态/工具栏挂载位和状态 aria-live，Monaco 创建单 model/editor，支持输入、焦点、明暗主题和系统等宽字体。Rust 注册官方 single-instance 插件和固定的 `PanelStatus`/`PanelAction` typed command/event 契约；第二次启动只唤醒既有 owner，不创建新窗口。capabilities 只开放本阶段所需命令/事件。保持 D-02/D-03/D-04 边界：不实现贴边触发、标签/恢复、文件、Quick Look、完整 Liquid Glass 或键位方案。主题提交边界：完成后单独提交 `chore: bootstrap tauri svelte typescript shell`，再单独提交 `feat: add monaco editor baseline`；每个提交前保留可运行状态。
  </action>
  <verify>
    <automated>rustc -Vv && cargo -V && rustup target list --installed | rg 'aarch64-apple-darwin' && npm run build && cargo check --manifest-path src-tauri/Cargo.toml</automated>
  </verify>
  <done>本地 `npm run tauri dev` 能启动单个 Tauri 窗口；窗口中 Monaco 可输入且按系统浅/深色切换；中英文文案有系统 locale fallback；重复启动路径只保留一个实例/窗口；Rust 与前端均通过编译检查。</done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: 接入唯一 NSPanel、完成 arm64 构建与冒烟证据</name>
  <files>native/EdgedorPanel/PanelOwner.swift, src-tauri/src/lib.rs, src/lib/tauri/panel.ts, src/App.svelte, native/EdgedorPanel/BRIDGE-RESULT.md, .planning/phases/01-spike/01-SMOKE.md</files>
  <action>
    在 Tauri macOS runner/原生 target 中实现 `@MainActor` 唯一 `PanelOwner`：仅持有一个 `NSPanel`，在主线程创建、显示、聚焦、隐藏和释放，并让真实 Tauri WebView 成为其内容层；Rust 只发送 `show`/`focus`/`hide`，回传 `{visible, focused, bridgeReady}`，Svelte 只消费类型化状态。桥接 ready 前显示加载态，ready 后显式聚焦 Monaco；失败时把错误写入 `BRIDGE-RESULT.md`，记录具体编译/运行症状、已验证事实、采用公开 `objc2`/AppKit bridge 的最小替代或阻塞原因，绝不把普通 CSS/Tauri WebviewWindow 伪装成完成。桥接成功后运行 arm64 `cargo tauri build` 产出开发版 `.app` 与 DMG（不声称公证、签名 updater 或 Release），并在 `01-SMOKE.md` 记录命令、产物路径和人工步骤：安装启动、重复启动、NSPanel show/focus/hide、WebView status round-trip、Monaco 输入、浅/深色和中英文切换。主题提交边界：桥接成功/失败记录单独提交 `spike: bridge tauri webview through native panel`；构建和证据单独提交 `build: verify arm64 development artifact`。若 Swift bridge 失败，先提交失败记录，不得静默改回普通窗口。
  </action>
  <verify>
    <automated>cargo check --manifest-path src-tauri/Cargo.toml && npm run build && cargo tauri build --target aarch64-apple-darwin --bundles app,dmg</automated>
    <human-check>在 macOS 26 Apple Silicon 上挂载生成 DMG 并启动：确认只有一个实例和一个侧边 NSPanel；通过显示/聚焦/隐藏入口观察状态回传；在 Monaco 输入文本；切换系统语言与浅/深色后重新启动确认文案/主题变化。若任一步失败，保留屏幕/日志和 `BRIDGE-RESULT.md`，不得宣称 Phase 1 通过。</human-check>
  </verify>
  <done>存在可启动的 arm64 `.app`/DMG；真实 NSPanel（而非 CSS 或普通 WebView 窗口）承载工作台并完成 typed show/focus/hide/status round-trip；单实例、Monaco 输入、语言和主题人工冒烟结果可追溯；Swift 不可行时有明确失败/替代记录。</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| macOS launcher → Tauri runtime | 第二次启动参数和激活请求进入不可信的应用入口。 |
| Svelte WebView → Rust command/event | 前端只可发送白名单 panel action；状态不能携带任意路径、正文或 native object。 |
| Rust/Tauri runner → Swift/AppKit | 跨语言桥接控制窗口句柄和焦点，必须限制在唯一 owner 与固定状态枚举。 |
| npm/Cargo/Xcode toolchain → build artifact | 外部依赖进入可安装应用，必须经过合法性核验并锁定版本。 |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|----------|----------|-----------|-------------|-----------------|
| T-01-01 | Spoofing | second launch / single-instance | mitigate | 使用官方 `tauri-plugin-single-instance`，第二次启动只唤醒已有 owner。 |
| T-01-02 | Tampering | WebView → Rust IPC | mitigate | `PanelAction` 白名单、强类型 status、最小 capabilities；拒绝任意 shell/path 能力。 |
| T-01-03 | Elevation | Swift `PanelOwner` | mitigate | `@MainActor` 唯一 `NSPanel` 引用，Swift 不保存业务数据、不执行任意文件操作。 |
| T-01-04 | Information Disclosure | status/error logging | mitigate | 状态只含布尔值；错误记录不得输出编辑正文、路径或凭证。 |
| T-01-05 | Denial of Service | bridge lifecycle | mitigate | bridge 未 ready 时返回可渲染错误，禁止重复创建 panel；退出时释放 owner。 |
| T-01-06 | Tampering | npm/Cargo dependencies | mitigate | Task 0 blocking legitimacy gate；锁文件、官方 registry 核验；禁止不存在的 npm single-instance 包。 |
| T-01-SC | Tampering | package/toolchain install | mitigate | 保留 Task 0 阻塞人工核验；对 `[ASSUMED]` 包核对 npmjs.com/crates.io 官方来源后才安装。 |
</threat_model>

<verification>
先执行 `npm run build` 与 `cargo check --manifest-path src-tauri/Cargo.toml`；再执行 `cargo tauri build --target aarch64-apple-darwin --bundles app,dmg`。最终以 `01-SMOKE.md` 中的 macOS 26 Apple Silicon 实机证据为准，编译通过不能替代真实 NSPanel 验收。
</verification>

<success_criteria>
- FOUND-01：arm64 开发版 DMG 可安装并启动，产物路径和启动结果已记录。
- FOUND-02：重复启动只保留一个应用实例、一个 WebView 和一个 NSPanel，且单实例插件通过 `cargo check` 与人工冒烟确认。
- FOUND-03：简体中文/英文系统语言切换后可见壳文案正确 fallback。
- FOUND-04：浅/深色模式切换后原生语义色与 Monaco 高对比主题一致，编辑区使用 SF Mono 等宽字体且可输入。
- 原生桥接失败时，`BRIDGE-RESULT.md` 明确记录失败原因、证据、替代方案和后续阻塞；普通 CSS/Tauri WebViewWindow 不得被标记为完成。
</success_criteria>

<output>
完成后创建 `.planning/phases/01-spike/01-SUMMARY.md`，包含实际提交边界、arm64 产物、人工冒烟结果和 Swift bridge 成功或失败证据。
</output>
