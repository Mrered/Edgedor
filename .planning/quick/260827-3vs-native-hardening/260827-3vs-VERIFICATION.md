---
phase: quick-260827-3vs-native-hardening
verified: 2026-08-26T19:12:54Z
status: human_needed
score: 5/8 must-haves verified
overrides_applied: 0
human_verification:
  - test: "退出链路故障注入"
    expected: "localStorage 异常、quit_requested 监听失败或投递失败时不会永久卡死；正常退出仍先检查点后确认。"
    why_human: "Rust 单测不含真实 Tauri WebView、前端 localStorage 和 AppKit 退出事件集成。"
  - test: "菜单、边缘、固定与多显示器面板状态"
    expected: "菜单显示落在有效屏幕内并处于 Floating；普通 blur 隐藏，固定 blur 仅 lower，focus 恢复 Floating；triggerEdge 与真实侧一致；启动 hide 不改写宽度。"
    why_human: "NSPanel 层级、聚焦、显示器断连和可见 frame 是 AppKit 真机运行时行为。"
  - test: "动画取消与快速反向操作"
    expected: "显示、隐藏、跨侧退出和跨侧进入阶段关闭动画或快速反向触发后，最终完全 orderOut 或位于最新目标侧，无幽灵窗口。"
    why_human: "NSTimer generation 取消竞态和窗口可见结果无法通当前静态检查或纯 Rust 测试证明。"
---

# Quick 260827-3vs：原生面板与退出握手加固验证报告

**Quick Goal:** 修复退出死锁、菜单显示绕过状态机、启动宽度污染、动画取消幽灵窗口和 `triggerEdge` 漂移，并保持严格单实例、单窗口、单 `NSPanel`。
**Verified:** 2026-08-26T19:12:54Z
**Status:** human_needed
**Re-verification:** 否，首次验证

## 目标达成度

### 可观察真相

| # | 真相 | 状态 | 证据 |
|---|---|---|---|
| 1 | 普通退出在前端监听、投递或检查点失败时不永久卡死，正常链路先检查点再确认 | ✓ VERIFIED | `ShutdownState` 以 3 次有限阈值放行；`delivery_failed()` 回滚投递态。`requestQuit()` 捕获 checkpoint 异常后仍调用 `quit_app`，只在 invoke 失败时释放 guard。 |
| 2 | 同一次普通退出可有限重投并确认，超阈值记录原因后放行 | ✓ VERIFIED | `MAX_BLOCKED_EXIT_ATTEMPTS = 3`；`AllowFallback(ListenerUnavailable/CheckpointUnconfirmed)` 由 `RunEvent::ExitRequested` 记录且不再 `prevent_exit`。专项单测覆盖未确认重投、无监听兜底、确认幂等。 |
| 3 | `RESTART_EXIT_CODE` 在任何普通退出状态前直接放行且不改写计数 | ✓ VERIFIED | `exit_requested()` 第一个分支先匹配 `tauri::RESTART_EXIT_CODE`，然后才设置 pending/增加计数；`restart_exit_code_is_always_allowed` 通过。 |
| 4 | 菜单、单实例、前端、边缘和全局隐藏均经统一原生动作/状态发布，不发布与真实 `NSPanel` 矛盾的状态 | ? UNCERTAIN | 静态连线已证明：菜单和单实例调用 `apply_panel_action`，边缘使用同源 `publish_panel_action`，全局点击调用 `apply_panel_action("hide")`。但真实焦点、屏幕 frame 和事件时序需真机验证。 |
| 5 | 未固定 blur 走 hide，固定 blur 走 lower，focus 恢复浮动并保留 `triggerEdge` | ? UNCERTAIN | `+page.svelte` 明确分流 `pinned ? 'lower' : 'hide'` 且 focus 调用 `panelAction('focus')`；Rust `lower/focus` 保留 `trigger_edge`，并分别设置 Normal/Floating 终态。层级和聚焦效果需 AppKit 真机确认。 |
| 6 | 不可见启动 hide 不捕获默认宽度，仅可见、有效屏幕、有效尺寸才保存 20%～60% | ✓ VERIFIED | `capture_width_ratio()` 首先检查 `isVisible`、有限正尺寸、中心点 `screen_at()` 成功和有效可用宽度；失败时早返且不写 `NSUserDefaults`。 |
| 7 | 关闭动画或新动作取消旧动画后，单一 `NSPanel` 按最新 Hidden/Visible 目标收敛，hide 最终 orderOut 且 `current_edge` 同步 | ? UNCERTAIN | `AnimationTarget`、generation 检查和 `converge_latest_target()` 实体完整；旧 timer 发现 generation 不匹配只 invalidate，hide completion 调用统一收敛。快速反向时的 NSTimer/AppKit 竞态需真机验证。 |
| 8 | 跨侧动画继续只用一个 `NSPanel` 两段式退出/进入，不创建第二表面 | ✓ VERIFIED | 仅一处 `NSPanel::alloc`/`initWithContentRect`，由 `NativePanel.panel` 进程期保留；跨侧分支对同一 panel 先 `exit_target`、再 `enter_start -> target`，无新窗口、快照或镜像表面。 |

**Score:** 5/8 真相已由自动证据确认；3 项需真机验证

### 必需产物

| 产物 | 预期 | 状态 | 详情 |
|---|---|---|---|
| `src-tauri/src/shutdown.rs` | 有限、可确认、可失败回滚的退出状态机 | ✓ VERIFIED | 存在且实质性实现；8 项退出专项测试通过；由 `lib.rs` `RunEvent::ExitRequested` 调用。 |
| `src-tauri/src/lib.rs` | 退出接线和统一 PanelState/事件发布 | ✓ VERIFIED | `apply_panel_action`/`publish_panel_action` 实质性实现，菜单、单实例、setup 与 Tauri command 均已接线。 |
| `src-tauri/src/native_panel.rs` | 菜单 target、宽度守卫、单面板最新动画目标 | ✓ VERIFIED | 仅一处 `NSPanel` 创建；retained menu target、有效屏幕恢复、generation 和统一收敛函数均已接线。 |
| `src/routes/+page.svelte` | 幂等退出、存储异常继续确认、blur/focus 分流 | ✓ VERIFIED | `requestQuit` 有 guard 且 checkpoint 单独 catch；监听注册失败有记录；blur/focus 调用统一 `panelAction`。 |

### 关键链路验证

| 起点 | 终点 | 方式 | 状态 | 详情 |
|---|---|---|---|---|
| `src-tauri/src/lib.rs` | `src-tauri/src/shutdown.rs` | `ExitRequested -> exit_requested -> prevent/emit/delivery_failed/allow` | ✓ WIRED | 成功投递等待确认，投递失败回滚，兜底仅记录不再 prevent。 |
| `src/routes/+page.svelte` | `src-tauri/src/lib.rs` | `quit_requested` 和 `⌘Q` 共用 `requestQuit -> quit_app` | ✓ WIRED | checkpoint 失败后仍 invoke；`quit_app` 先 `confirm_exit` 再 `app.exit(0)`。 |
| `src-tauri/src/native_panel.rs` | `src-tauri/src/lib.rs` | menu/single-instance/edge/dismiss -> 统一 action/publish | ✓ WIRED | SDK 因目标文件字面匹配限制报未验证；人工检查确认 `crate::apply_panel_action`/`crate::publish_panel_action` 真实调用。 |
| `src/routes/+page.svelte` | `panel_action` | blur 分流 lower/hide，focus 调 focus | ✓ WIRED | 前端分流与 Rust action allowlist 及 NativePanel action 分支一致。 |
| `capture_width_ratio` | `NSUserDefaults` | 可见性/有效 frame/screen/ratio 守卫后写入 | ✓ WIRED | 不可见或屏幕不匹配时在写入前返回。 |
| `set_panel_animation` | `animate_panel_frame`/`animate_panel_out` | generation + `AnimationTarget` + `converge_latest_target` | ✓ WIRED | SDK 因起点非文件路径报未验证；人工检查确认关闭动画、hide completion 和跨侧 completion 均进入统一收敛。 |

### 数据流追踪（Level 4）

| 产物 | 状态数据 | 来源 | 产生真实数据 | 状态 |
|---|---|---|---|---|
| `src/routes/+page.svelte` | `status.visible/focused/triggerEdge` | 原生 action 返回 -> `PanelState` -> `panel_status` -> `listenPanelStatus` | 是，来自实际 NativePanel action 返回与完整 Rust 状态 | ✓ FLOWING（真机时序待验） |
| `src-tauri/src/shutdown.rs` | pending/listener/delivery/confirmed/计数 | Tauri `ExitRequested`、前端 ready/confirm 命令和 emit 结果 | 是，无硬编码静态返回 | ✓ FLOWING |
| `src-tauri/src/native_panel.rs` | `AnimationTarget`/generation/`current_edge` | show/edge/hide/lower/focus 最新动作 | 是，由实际目标 frame 和 action 更新 | ✓ FLOWING（NSTimer 竞态待验） |

### 行为快速检查

| 行为 | 命令 | 结果 | 状态 |
|---|---|---|---|
| 退出状态机 | `cargo test --manifest-path src-tauri/Cargo.toml shutdown` | 8 passed, 0 failed | ✓ PASS |
| Rust 全量单测 | `cargo test --manifest-path src-tauri/Cargo.toml` | 11 passed, 0 failed；doc-tests 通过 | ✓ PASS |
| Rust 编译 | `cargo check --manifest-path src-tauri/Cargo.toml` | 退出码 0 | ✓ PASS |
| Svelte/TypeScript | `npm run check` | 0 errors, 0 warnings | ✓ PASS |
| 会话快照自检 | `npm run check:session` | `Edgedor session self-check passed` | ✓ PASS |
| 生产构建 | `npm run build` | 构建成功，仅既有 Monaco chunk 体积提示 | ✓ PASS |
| 补丁格式 | `git diff --check` 及 `git diff de5b00b^..110061a --check` | 无输出 | ✓ PASS |
| 单 `NSPanel` 结构 | `rg "NSPanel::alloc|NSPanel::init|WebviewWindowBuilder|snapshot|mirror"` | 仅 `native_panel.rs` 一处 alloc/init，无第二表面创建 | ✓ PASS |

### Probe 执行

未声明、未发现 `probe-*.sh`；本 quick 的可运行验证已由上述测试与构建覆盖。

### 需求覆盖

| 需求 | 来源计划 | 描述 | 状态 | 证据 |
|---|---|---|---|---|
| PANEL-05 | 260827-3vs | 按显示器可用宽度保存 20%～60% 面板比例 | ? NEEDS HUMAN | 保存守卫与比例钳制存在；重启后不被初始 hide 改写需真机检查。 |
| PANEL-06 | 260827-3vs | 未固定外部点击/失焦隐藏，固定时不隐藏 | ? NEEDS HUMAN | 全局点击监听与 blur 分流已接线，真实跨应用行为待验。 |
| PANEL-07 | 260827-3vs | 聚焦浮动，失焦降为普通层级 | ? NEEDS HUMAN | `focus/lower` 设置 Floating/Normal 并发布状态，AppKit 窗口层级待验。 |
| PANEL-08 | 260827-3vs | 跨侧动画速度可调且可关闭 | ? NEEDS HUMAN | 单面板两段动画、时长设置和取消收敛存在；视觉与竞态结果待验。 |
| PANEL-10 | 260827-3vs | 图形化固定、设置和退出入口 | ✓ SATISFIED | 面板有设置和固定按钮，菜单退出走 `terminate:` -> `ExitRequested` 握手，固定恢复时强制 false。 |
| SESSION-08 | 260827-3vs | 正常退出保存版本化恢复快照 | ✓ SATISFIED | `requestQuit -> checkpoint -> writeSessionCheckpoint`，会话模型包含选区/滚动/分组等快照字段，会话自检通过。 |
| DIST-02 | 260827-3vs | 面板内 `⌘,` 设置与 `⌘Q` 退出 | ✓ SATISFIED | keydown 接线仅在面板可见时处理；`⌘Q` 共用 `requestQuit`。 |

### 反模式扫描

| 文件 | 行 | 模式 | 严重度 | 影响 |
|---|---:|---|---|---|
| 四个修改源文件 | — | 未发现无跟踪的 TBD/FIXME/XXX，未发现用户可见占位或空 handler | ℹ️ Info | 无阻断性反模式。`placeholder` 命中均为真实输入框属性；`return []` 为空查询的正常返回。 |

### 反证审查

- **仅部分可自动证明的要求：** PANEL-05/06/07/08 的代码接线完整，但真实 AppKit 层级、显示器断连、动画视觉终态仍需人工。
- **可能误导的测试：** 8 项 shutdown 单测试证明纯状态转移，但不会真实创建 WebView、使 `app.emit` 失败或使 localStorage 抛错；因此未用它们替代退出集成冒烟。
- **未自动覆盖的错误路径：** `panel_status` emit 失败仅有静态审查证明 PanelState 先更新且失败只记录；当前没有 AppHandle 失败注入测试。

### 需要人工验证

#### 1. 退出链路故障注入

**测试：** 分别让 localStorage/checkpoint 抛错、让 quit 监听初始化失败或让 `quit_requested` 投递失败，再使用 `⌘Q`、菜单退出和系统退出。
**预期：** checkpoint 异常被记录但仍确认退出；监听/投递故障可重试且最多阻止 3 次，之后记录原因并放行；无永久卡死。
**为何需要人工：** 需真实 Tauri/WebView/AppKit 退出事件与故障注入。

#### 2. 菜单、边缘、固定与多显示器面板状态

**测试：** 保存非默认宽度后重启；通过菜单、Finder 单实例重开、左右边缘和全局外部点击反复显示/隐藏；再分别以未固定和固定状态切换应用、重新聚焦，并测试外接屏断开后菜单显示。
**预期：** 启动 hide 不改写宽度；菜单显示回退到主屏右侧且可聚焦；普通 blur 隐藏，固定 blur 可见但降层，focus 恢复浮动；`triggerEdge` 不漂移。
**为何需要人工：** 这些是多显示器、跨应用激活、窗口层级和可见性的系统级行为。

#### 3. 动画取消与快速反向操作

**测试：** 分别在显示、隐藏、跨侧旧侧退出、新侧进入四个阶段关闭动画，并快速交替 show/hide/左右触发。
**预期：** 每次最终要么完全 orderOut，要么位于最新目标显示器与目标侧且可聚焦；无幽灵窗口，无下次换侧方向错误。
**为何需要人工：** 需观察真实 NSTimer 时序和 AppKit 窗口终态。

### 结论

未发现可观察的源码缺失、占位实现、未接线产物或阻断性反模式。退出状态机、发布入口、宽度守卫和单 `NSPanel` 动画目标在代码中都是实质性且已接线的。但计划明确包含 AppKit 真机冒烟，而当前自动测试不能证明窗口层级、多屏恢复和动画竞态，因此正确状态是 `human_needed`。

---

_Verified: 2026-08-26T19:12:54Z_
_Verifier: the agent (gsd-verifier)_
