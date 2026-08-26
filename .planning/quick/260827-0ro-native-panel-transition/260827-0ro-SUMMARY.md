---
phase: quick
plan: 260827-0ro-native-panel-transition
subsystem: native-window
tags: [macos, appkit, nspanel, tauri, svelte]
requires:
  - phase: existing-native-panel
    provides: 单 NSPanel、边缘触发、浮动层级与面板状态桥接
provides:
  - 单窗口跨侧两段式动画与可失效的旧动画代次
  - 固定面板失焦降层及重新聚焦恢复浮动层级
affects: [panel-animation, panel-focus, pinned-window]
tech-stack:
  added: []
  patterns: [原子代次取消 AppKit 定时动画, Rust 与 TypeScript 面板动作白名单同步]
key-files:
  created: []
  modified:
    - src-tauri/src/native_panel.rs
    - src-tauri/src/lib.rs
    - src/lib/tauri/panel.ts
    - src/routes/+page.svelte
key-decisions:
  - "跨侧动画继续使用唯一 NSPanel，以旧侧滑出和新侧滑入各占总时长一半。"
  - "固定只阻止自动隐藏；失焦使用 lower 降到普通窗口层级。"
patterns-established:
  - "每次新过渡递增 animation_generation，旧 NSTimer 在下一帧检测代次后失效。"
requirements-completed: []
duration: 9min
completed: 2026-08-27
---

# Quick 260827-0ro：原生面板跨侧过渡与固定层级总结

**单个 NSPanel 现在以同一总时长完成旧侧滑出与新侧滑入，并在固定失焦时保留可见但降到普通窗口层级。**

## 性能

- **耗时：** 9 分钟
- **开始：** 2026-08-26T16:34:00Z
- **完成：** 2026-08-26T16:43:13Z
- **任务：** 2
- **修改文件：** 4

## 完成内容

- 跨侧触发不再把可见 frame 直接插值到另一侧，而是先退出旧侧，再从新侧屏外进入。
- 两段动画共享用户配置的总时长，连续触发通过原子代次使旧定时器失效并保证最新目标收敛。
- 新增 `lower` 面板动作；固定失焦保持可见并降层，重新聚焦、边缘呼出、显式显示和再次固定均恢复浮动层级。
- 前端 blur/focus 监听成对注册和清理，未固定失焦仍沿用隐藏行为。

## 任务提交

1. **任务 1：实现单窗口两段式跨侧动画** - `e68d0e0`（fix）
2. **任务 2：让固定面板失焦降层并在聚焦时恢复** - `e68d0e0`（fix）

## 文件说明

- `src-tauri/src/native_panel.rs` - 管理动画代次、跨侧两段过渡、浮动/普通层级与隐藏动画。
- `src-tauri/src/lib.rs` - 将 `lower` 加入 Tauri 命令白名单和非 macOS 回退契约。
- `src/lib/tauri/panel.ts` - 扩展类型安全的 `PanelAction` 联合类型。
- `src/routes/+page.svelte` - 固定失焦调用 `lower`，可见面板聚焦时调用 `focus`。

## 决策

- 保持严格单窗口，不创建镜像或辅助动画窗口。
- 跨侧时前后两段分别使用总动画时长的一半；奇数毫秒余量归入进入段，避免总时长翻倍。
- 当前侧只在跨侧进入段完成后更新，避免过渡中重触发时把未到达的新侧误认为当前侧。

## 计划偏差

无，按计划范围执行。

## 遇到的问题

无阻塞问题。自动检查全部通过。

## 验证

- `git diff --check`：通过。
- `npm run check`：通过，0 errors、0 warnings。
- `npm run build`：通过。
- `cargo check --manifest-path src-tauri/Cargo.toml`：通过。
- `cargo test --manifest-path src-tauri/Cargo.toml`：通过，3 项测试全部成功。
- AppKit 动画、跨应用层级和多显示器行为仍需在打包后的 macOS 应用中做计划所列人工冒烟。

## 用户设置

无。

## 后续就绪情况

- 源代码和动作契约已完成，可进入应用打包与 macOS 实机冒烟。
- 人工冒烟应覆盖左右连续触发、关闭动画、固定失焦、重新聚焦和取消固定后的下一次失焦。

## Self-Check: PASSED

- 提交 `e68d0e0` 存在，且只包含计划授权的四个源码文件。
- 本总结文件已创建；PLAN、SUMMARY 和 STATE 均未纳入源码提交。

---
*Quick: 260827-0ro-native-panel-transition*
*完成日期：2026-08-27*
