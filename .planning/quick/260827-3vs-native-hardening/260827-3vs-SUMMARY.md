---
phase: quick-260827-3vs-native-hardening
plan: 01
subsystem: native-lifecycle
tags: [tauri, appkit, nspanel, shutdown, animation, macos]
requires:
  - phase: quick-260827-1ij-session-checkpoints
    provides: 会话检查点边界与基础原生退出握手
  - phase: quick-260827-0ro-native-panel-transition
    provides: 单 NSPanel 两段跨侧动画与 lower/focus 动作
provides:
  - 可重试、可确认、有限兜底且不拦截重启码的退出状态机
  - 菜单、单实例、边缘、全局隐藏和前端动作共享的 PanelState 发布入口
  - 按最新 Hidden/Visible 目标收敛的单 NSPanel 动画取消语义
affects: [native-panel, session-recovery, menu-bar, updater, release]
tech-stack:
  added: []
  patterns: [finite-shutdown-handshake, native-action-then-state-publication, latest-animation-target]
key-files:
  created: []
  modified:
    - src-tauri/src/shutdown.rs
    - src-tauri/src/lib.rs
    - src-tauri/src/native_panel.rs
    - src/routes/+page.svelte
key-decisions:
  - "普通退出最多阻止三次；监听不可用或检查点始终未确认时记录原因并有限放行，RESTART_EXIT_CODE 始终优先直放。"
  - "原生动作成功后先固化完整 PanelState，再尝试发送 panel_status；事件发送失败不回滚真实状态。"
  - "跨侧继续复用唯一 NSPanel，旧 timer 仅失效，最终 frame、层级、可见性和 current_edge 由最新逻辑目标统一收敛。"
patterns-established:
  - "退出投递失败只回滚本次 delivery 状态，不伪造前端确认。"
  - "菜单栏 Objective-C target 只调用进程内固定 show 入口，并在进程期保留。"
  - "宽度只从可见、有限且中心命中当前 NSScreen 的面板捕获。"
requirements-completed: [PANEL-05, PANEL-06, PANEL-07, PANEL-08, PANEL-10, SESSION-08, DIST-02]
duration: 12min
completed: 2026-08-27
---

# Quick 260827-3vs：原生面板与退出握手加固摘要

**退出链路在监听、事件发送或本地检查点失败时不再永久卡死，所有原生面板来源与动画取消也统一收敛到真实单 NSPanel 状态。**

## Performance

- **Duration:** 12 分钟
- **Started:** 2026-08-26T18:56:00Z
- **Completed:** 2026-08-26T19:08:03Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- 退出状态机支持 emit 失败回滚、未确认重投递、监听永久不可用兜底、重复确认幂等和 updater 重启码无条件直放。
- 前端检查点或 localStorage 抛错时会记录并提示，但仍确认退出；只有原生命令失败才释放并发 guard 供下次重试。
- 菜单显示、单实例再次打开、边缘触发、全局点击隐藏和前端 show/focus/hide/lower 均同步真实 NSPanel、Rust PanelState 与 panel_status。
- 菜单 target 在进程期保留；失效显示器上的旧 frame 会回退到主屏右侧，启动不可见的 800×600 默认 frame 不再写回宽度比例。
- 动画使用共享 Hidden/Visible 目标；关闭动画或新动作使旧 generation 失效后，窗口会统一收敛 frame、层级、orderOut 与 current_edge。

## Task Commits

1. **任务 1 RED：锁定可靠退出握手行为** - `de5b00b` (`test`)
2. **任务 1 GREEN：实现可重试退出与前端异常兜底** - `d12b672` (`fix`)
3. **任务 2：统一原生面板动作和状态发布** - `22ecde5` (`fix`)
4. **任务 3：按最新逻辑目标收敛动画取消** - `110061a` (`fix`)

## Files Created/Modified

- `src-tauri/src/shutdown.rs` - 纯 Rust 有限退出状态机及八项退出专项测试。
- `src-tauri/src/lib.rs` - 退出事件可靠接线和统一 PanelState/panel_status 发布入口。
- `src-tauri/src/native_panel.rs` - retained 菜单 target、有效 frame/宽度守卫和最新动画目标收敛。
- `src/routes/+page.svelte` - 幂等退出请求、存储异常继续确认及监听初始化失败记录。

## Decisions Made

- `MAX_BLOCKED_EXIT_ATTEMPTS` 取 3，容纳首次投递和至少一次显式重试，同时避免不可恢复死锁。
- 边缘呼出因需要触发时的屏幕坐标，先执行专用 `show_at_edge_at`，再进入与通用动作相同的完整状态发布助手。
- 不引入第二窗口、快照或镜像表面；跨侧仍由同一个 NSPanel 先退出旧侧、再进入新侧。

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None. 扫描到的空字符串、空数组和可空 DOM 引用均为既有 UI 状态，不是未接线占位实现。

## Threat Flags

None. 新增 AppKit 菜单 target、退出边界和 frame 信任边界均已在计划 threat model 中登记并按缓解措施实现。

## Issues Encountered

- Context7 CLI 在当前环境不可用；objc2 0.6 的菜单 target 写法改为参考本机已锁定 crate 源码中的 `define_class!` 官方示例，未增加依赖。

## Verification

- `cargo test --manifest-path src-tauri/Cargo.toml` - 通过，11 项测试成功。
- `cargo check --manifest-path src-tauri/Cargo.toml` - 通过。
- `npm run check` - 通过，0 errors / 0 warnings。
- `npm run check:session` - 通过。
- `npm run build` - 通过；仅保留既有 Monaco chunk 体积提示。
- `git diff --check` - 通过。
- 静态检查确认 blur 使用 `pinned ? 'lower' : 'hide'`，focus 使用 `panelAction('focus')`。

## User Setup Required

None - 无需外部服务配置。

## Next Phase Readiness

- 自动验证已完成，可进入可安装构建的 macOS 真机人工冒烟。
- 人工冒烟仍需覆盖 localStorage/监听失败退出、多显示器断连菜单显示、固定 lower/focus 往返，以及四个动画阶段关闭动画和快速反向动作。

## Self-Check: PASSED

- 四个计划源码文件均存在。
- `de5b00b`、`d12b672`、`22ecde5` 和 `110061a` 均存在于当前 Git 历史。
- SUMMARY 已创建；PLAN、SUMMARY、STATE 与 `install-backups/` 均未纳入源码提交。

---
*Phase: quick-260827-3vs-native-hardening*
*Completed: 2026-08-27*
