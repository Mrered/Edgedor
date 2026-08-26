---
phase: quick-260827-1ij-session-checkpoints
plan: 01
subsystem: session-lifecycle
tags: [tauri, svelte, localstorage, shutdown, updater]
requires:
  - phase: 03-editor-session
    provides: 会话模型、独立设置序列化和恢复快照
provides:
  - 可注入的会话存储契约与操作日志自检
  - 仅激活切换、面板隐藏、正常退出和更新重启可写的内容检查点
  - Cmd+Q、启动早期原生退出和 updater relaunch 共享的可靠退出握手
affects: [session-recovery, native-panel, updater, release]
tech-stack:
  added: []
  patterns: [apply-update-checkpoint separation, pure shutdown state machine]
key-files:
  created:
    - src/lib/session/storage.ts
    - src-tauri/src/shutdown.rs
  modified:
    - src/lib/session/index.ts
    - src/lib/session/selfcheck.ts
    - src/routes/+page.svelte
    - src-tauri/src/lib.rs
key-decisions:
  - "内存会话变更、设置持久化和内容快照分为三个独立入口。"
  - "原生退出首次请求才通知前端，确认后放行，RESTART_EXIT_CODE 始终直接放行。"
patterns-established:
  - "applySession 只改内存，updateSettings 只保存设置，checkpoint 才保存内容。"
  - "用 activeGroupId + activeTabId 比较识别真实激活切换。"
requirements-completed: []
duration: 17min
completed: 2026-08-27
---

# Quick 260827-1ij：会话检查点总结

**Edgedor 的会话内容现在只在明确生命周期边界写盘，并在所有正常退出与更新重启前完成同一检查点。**

## 性能

- **耗时：** 17 分钟
- **开始：** 2026-08-26T17:34:18Z
- **完成：** 2026-08-26T17:51:13Z
- **任务：** 3
- **源文件：** 6

## 完成内容

- 新增窄 `SessionStorage` 契约，设置写入、内容检查点和显式删除各司其职；关闭恢复后任何检查点都只能删除快照。
- 页面分离 `applySession`、`updateSettings` 和 `checkpoint`，普通编辑、设置、过期、启动恢复与预览重水合不再写会话内容。
- 真实标签激活切换、面板显示到隐藏、Cmd+Q、原生退出与 updater relaunch 均经过统一检查点。
- Rust 纯状态机覆盖首次退出、重复退出、前端确认和 `RESTART_EXIT_CODE` 直接放行；启动早期退出会在前端监听就绪后补发且只发一次。

## 任务提交

1. **任务 1 RED：锁定存储操作边界** - `efe1ce0`
2. **任务 1 GREEN：新增会话存储契约** - `588629f`
3. **任务 2：限定会话快照生命周期边界** - `d6b89c3`
4. **任务 3：原生退出前完成检查点** - `e439f52`
5. **验证修复：监听就绪后交付启动早期退出** - `b8ae1a6`

## 文件变更

- `src/lib/session/storage.ts` - 定义设置持久化、内容检查点和快照删除契约。
- `src/lib/session/index.ts` - 对外导出存储契约与会话检查点读取别名。
- `src/lib/session/selfcheck.ts` - 用记录操作的内存 Storage 验证隐私与版本化快照语义。
- `src/routes/+page.svelte` - 拆分内存、设置、检查点路径，并实现统一退出请求。
- `src-tauri/src/shutdown.rs` - 实现可单测的退出决策状态机。
- `src-tauri/src/lib.rs` - 拦截 `RunEvent::ExitRequested`、通知前端并在确认后放行。

## 决策

- 保留 `localStorage` 作为当前恢复介质，通过窄接口集中所有写盘语义，不引入新依赖。
- 更新重启仍调用 Tauri process plugin 的 `relaunch`，前端先检查点，Rust 对重启码无条件放行。

## 计划偏差

### 自动修复问题

**1. [Rule 1 - Bug] 修复启动早期原生退出事件丢失**

- **发现阶段：** 计划完成验证
- **问题：** 前端监听注册前的首次普通退出会被 Rust 阻止，但一次性事件无人接收，之后的退出又因去重而不再通知。
- **修复：** Rust 分开 pending、listener ready 和 delivered 状态；前端注册监听后调用 `mark_quit_listener_ready`，并领取一次待处理退出。
- **验证：** 新增纯状态机测试覆盖“早期退出 → 监听就绪 → 只补发一次”，定向 5 项与 Rust 全量 8 项测试均通过。
- **提交：** `b8ae1a6`

**偏差总数：** 1 个自动修复。修复仅补齐原计划的正常退出可靠性，无范围扩张。

## 遇到的问题

- 计划中的 `rg` 校验模式会把 `deserializeSession` 误判为 `serializeSession`；页面改用 `readSessionCheckpoint` 别名，保持读取语义不变并使约束可机械验证。
- 原生退出监听调整为页面挂载后最先注册，缩小启动时菜单退出事件丢失窗口。

## 验证

- `npm run check:session`
- `npm run check`
- `npm run build`
- 页面无直接 `localStorage.setItem/removeItem` 或 `serializeSession`
- `cargo check --manifest-path src-tauri/Cargo.toml`
- `cargo test --manifest-path src-tauri/Cargo.toml shutdown`
- `cargo test --manifest-path src-tauri/Cargo.toml`
- `git diff --check`

## 用户配置

无。

## 后续就绪度

- 可进入安装包人工冒烟，重点验证 Cmd+Q、菜单栏退出和更新自动重启。
- 无代码或自动验证阻塞。

## Self-Check: PASSED

- 六个计划源文件均存在。
- 四个任务提交与一个验证修复提交均存在于当前历史。

---
*Phase: quick-260827-1ij-session-checkpoints*
*Completed: 2026-08-27*
