---
phase: quick-260827-5ze-final-lifecycle-fixes
plan: 01
subsystem: lifecycle-and-native-panel
tags: [tauri, svelte, localstorage, shutdown, updater, nspanel]
requires:
  - phase: quick-260827-1ij-session-checkpoints
    provides: 会话检查点与原生退出握手
provides:
  - 显式成功或失败的会话检查点结果
  - 保存失败时可取消、可重试且不会静默放行的退出流程
  - 隐藏、更新重启和原生面板焦点的真实状态收敛
  - 前端订阅后读取的权威 PanelStatus 启动快照
affects: [session-recovery, updater, shutdown, native-panel]
tech-stack:
  added: []
  patterns: [discriminated checkpoint result, pure shutdown state machine, subscribe-then-snapshot]
key-files:
  created: []
  modified:
    - src/lib/session/storage.ts
    - src/lib/session/selfcheck.ts
    - src/lib/i18n.ts
    - src/routes/+page.svelte
    - src-tauri/src/shutdown.rs
    - src-tauri/src/native_panel.rs
    - src-tauri/src/lib.rs
key-decisions:
  - "检查点失败默认保留进程；只有用户明确确认丢弃未写入状态才退出。"
  - "前端先订阅 panel_status 再读取权威快照，并用事件版本避免旧快照覆盖并发事件。"
  - "前端监听器尚未就绪时，第二次普通退出才显示原生安全确认，取消后重新计数。"
requirements-completed: [PANEL-06, PANEL-07, SESSION-08, DIST-02]
completed: 2026-08-27
---

# Quick 260827-5ze：最终生命周期失败语义总结

**Edgedor 现在会在检查点失败时优先保住当前进程和内存状态，同时让原生面板事实、退出握手与更新重启保持一致。**

## 完成内容

- `writeSessionCheckpoint` 返回判别联合结果，并保留 `setItem`、`removeItem` 的原始异常。
- 正常退出检查点失败时显示中英文安全确认；取消会重置握手并允许下次重试，未确认不再有限次数后自动退出。
- 前端监听尚未就绪时，首次退出仅阻止，第二次显示非阻塞原生警告；重复请求不重复弹窗，取消后重新计数，确认后才退出。
- 面板隐藏检查点失败仍采用原生隐藏状态并提示；更新安装后的检查点失败会取消 `relaunch`。
- Hidden 动画目标收到 focus 时继续隐藏并返回 `visible=false`、`focused=false`；Visible 目标维持既有聚焦行为。
- 前端初始状态为隐藏，首个原生状态前不发送 blur/focus 动作；注册监听后立即读取 `get_panel_status`，并避免并发事件被较旧快照覆盖。

## 提交

1. `ae82070` — 定义检查点和退出失败红灯测试。
2. `0377b50` — 实现显式检查点结果与可取消退出。
3. `e389ae9` — 收敛隐藏和更新重启失败路径。
4. `3afe35c` — 定义原生面板目标 focus 语义测试。
5. `d5fbcbb` — 实现 Hidden/Visible 目标收敛与前端桥接守卫。
6. `61b8204` — 补齐早期退出原生确认与权威面板快照。

## 验证

- `npm run check:session`：通过。
- `npm run check`：0 errors、0 warnings。
- `npm run build`：通过。
- `cargo test --manifest-path src-tauri/Cargo.toml`：18 项通过。
- `cargo check --manifest-path src-tauri/Cargo.toml`：通过。
- `git diff --check`：通过。

## 人工验证

- 仍需在打包后的 macOS 应用中注入 localStorage 写入失败，验证隐藏、正常退出和更新重启提示。
- 仍需冷启动及隐藏动画期间切换焦点，验证 NSPanel 不被意外复活。

## 偏差

- 最终审查发现前端监听前的多次退出会一直被阻止且没有可见反馈，因此增加第二次早退的原生安全确认；该路径仍保持默认取消和明确确认后才退出。
- 最终审查发现 setup 阶段的 `panel_status` 可能早于前端监听，新增订阅后权威快照与事件版本守卫。

## Self-Check: PASSED

- 七个修改源码文件均存在。
- 六个源码与测试提交均存在于当前 Git 历史。
- PLAN、SUMMARY 和 STATE 未纳入源码提交。

---
*Quick: 260827-5ze-final-lifecycle-fixes*
*完成日期：2026-08-27*
