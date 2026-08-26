---
phase: quick-260827-4ki-data-safety
plan: 01
subsystem: frontend-data-safety
tags: [tauri, svelte, monaco, session-recovery, drag-drop, shortcuts, save-race]
requires:
  - phase: quick-260827-1ij-session-checkpoints
    provides: 设置与会话分离持久化及合法检查点边界
  - phase: quick-260827-31h-editor-groups
    provides: 最多四编辑组、组比例和跨组标签移动
provides:
  - localStorage 设置、标签和编辑组的逐字段运行时验证与安全恢复
  - preserveOnRestart=false 时先删 SESSION_KEY 且绝不读取的启动入口
  - Tauri 原生多文件拖放和私有 MIME 内部标签拖放隔离
  - UI 验证与 Monaco 注册共享的有限快捷键解析契约
  - 不可变 SaveRequest 与按稳定 tabId 的条件保存归并
affects: [session-recovery, file-open, editor-shortcuts, file-save, release]
tech-stack:
  added: []
  patterns: [unknown-to-validated-state, settings-first-startup, private-mime-drag, shared-shortcut-parser, immutable-save-request]
key-files:
  created:
    - src/lib/session/save.ts
  modified:
    - src/lib/session/model.ts
    - src/lib/session/storage.ts
    - src/lib/session/index.ts
    - src/lib/session/selfcheck.ts
    - src/lib/shortcuts.ts
    - src/lib/shortcuts.selfcheck.ts
    - src/lib/editor/monaco.ts
    - src/routes/+page.svelte
key-decisions:
  - "所有持久化 JSON 都从 unknown 逐字段重建；完全不可恢复的会话由启动入口删除，部分损坏只丢弃坏标签。"
  - "独立设置优先于旧会话设置；明确关闭恢复时在任何 SESSION_KEY getItem 前先删除并直接短路。"
  - "外部文件只接受 Tauri Webview drop.paths，HTML5 DataTransfer 仅以 application/x-edgedor-tab 授权内部标签移动。"
  - "保存结果只更新仍存在的捕获 tabId，且内容、编码和换行符任一变化都保留 dirty。"
patterns-established:
  - "恢复边界以 unknown 输入、有限枚举和有限数值守卫生成全新 plain object。"
  - "异步 Tauri 监听注册使用 disposed 与延迟 resolve 自释放，组件销毁后不遗留监听。"
  - "快捷键接受集由 parseShortcut 单点定义，Monaco 只消费解析成功结果。"
requirements-completed: [EDIT-10, SESSION-02, SESSION-08, SESSION-09, FILE-03, FILE-04, FILE-07]
duration: 12min
completed: 2026-08-27
---

# Quick 260827-4ki：前端数据安全边界摘要

**损坏恢复数据、外部拖放、内部标签授权、快捷键文本和异步保存结果现在都经过稳定边界处理，不再污染运行态或误写其他标签。**

## Performance

- **Duration:** 12 分钟
- **Started:** 2026-08-26T19:28:15Z
- **Completed:** 2026-08-26T19:40:21Z
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments

- 设置、标签、编辑器快照和最多四个编辑组从 `unknown` 逐项验证；坏字段回退、坏标签丢弃、关系按确定规则修复，空或整体损坏快照被删除。
- 启动恢复集中到 `readStartupState`：先读独立设置，明确关闭恢复时只删除会话键并短路，操作日志证明不发生会话读取。
- Finder 多文件按 Tauri 原生 `drop.paths` 顺序复用现有 `openPath`；HTML5 只处理带私有 MIME 的内部标签，并在失焦、结束、丢放、离开和销毁时清理状态。
- 快捷键校验与 Monaco 注册共用有限 `ShortcutKey` 解析结果，拒绝裸键、重复语义修饰键、未知键和 Vim 命令序列。
- 保存操作冻结目标、内容、编码、换行符、标题、路径和类型；异步返回只归并仍存在的原标签，三个持久字段任一变化均保持未保存状态。

## Task Commits

1. **任务 1 RED：锁定恶意恢复数据与启动读取顺序** - `8ddd1ea` (`test`)
2. **任务 1 GREEN：实现逐字段恢复与设置优先启动** - `89ff7a2` (`fix`)
3. **任务 2 RED：锁定快捷键接受集与注册集一致性** - `04bf66e` (`test`)
4. **任务 2 GREEN：隔离原生/内部拖放并统一快捷键契约** - `2c6407b` (`fix`)
5. **任务 3 RED：锁定切换、编辑和关闭标签保存竞态** - `59d6dc7` (`test`)
6. **任务 3 GREEN：实现不可变保存请求与条件归并** - `6adcb3f` (`fix`)

## Files Created/Modified

- `src/lib/session/model.ts` - 持久设置、标签、编辑器快照和编辑组的逐字段重建及关系修复。
- `src/lib/session/storage.ts` - 设置优先、关闭恢复先删不读、损坏会话自动清理的启动入口。
- `src/lib/session/save.ts` - 不可变保存请求和按稳定标签标识归并的纯函数。
- `src/lib/session/index.ts` - 导出保存纯函数。
- `src/lib/session/selfcheck.ts` - 恶意快照、启动存储顺序和异步保存竞态回归自检。
- `src/lib/shortcuts.ts` - 有限键联合、别名规范化和共享解析契约。
- `src/lib/shortcuts.selfcheck.ts` - 全键集合、别名、裸键和 Vim 序列自检。
- `src/lib/editor/monaco.ts` - 从共享解析结果映射穷尽 Monaco KeyCode。
- `src/routes/+page.svelte` - 原生多文件拖放、内部 MIME 分流、设置优先启动和稳定保存调用链。

## Decisions Made

- 文件与预览标签缺少非空路径时不可恢复；临时标签只要必填字段合法即可保留。
- 恢复旧版会话设置时强制采用默认 `preserveOnRestart=true`，避免缺失独立设置被旧会话内的关闭值意外短路。
- 原生拖放监听注册 Promise 即使在组件销毁后才完成，也会在 resolve 分支立即调用 unlisten。
- 保存成功只改变绑定相关字段，编辑期间产生的内容、编码、换行符、语言和编辑器状态全部保留。

## Deviations from Plan

None - 计划按 TDD 顺序执行；任务 1 为校验 `shortcutOverrides` 提前加入了裸键拒绝的最小条件，任务 2 随后在同一计划范围内完成完整解析器收敛。

## Known Stubs

None. 扫描到的空字符串、空对象、空数组和可空引用均为合法初始状态、验证累加器或 UI 状态，不是未接线占位实现。

## Threat Flags

None. localStorage、Finder/AppKit、DataTransfer、快捷键文本和异步保存五个信任边界均已在计划 threat model 中登记并落实对应缓解措施；未新增命令、权限或网络入口。

## Issues Encountered

- Context7 CLI 在当前环境不可用；Tauri 2 `onDragDropEvent` 的联合 payload 与 unlisten 契约改为核对项目锁定依赖 `node_modules/@tauri-apps/api/webview.d.ts`。
- 初版 Vim 自检误把合法 `Ctrl+K`/`Ctrl+J` 也视为命令序列；测试修正为只拒绝 `dd`、`g*`、`:%s` 等非 Monaco 组合，Vim 合法修饰键覆盖仍可注册。

## Verification

- `npm run check:session` - 通过。
- `npm run check:shortcuts` - 通过。
- `npm run check` - 通过，0 errors / 0 warnings。
- `npm run build` - 通过；仅保留既有 Monaco chunk 体积提示。
- `cargo check --manifest-path src-tauri/Cargo.toml` - 通过。
- `cargo test --manifest-path src-tauri/Cargo.toml` - 通过，11 项测试成功。
- `git diff --check` - 通过。
- 静态检查确认页面不再包含 HTML5 `File.path` 外部拖放、窗口级 `drop`/`dragover` 处理器。

## User Setup Required

None - 无需新增权限、依赖或外部服务配置。

## Next Phase Readiness

- 自动验证全部通过，可进入 macOS 真机人工冒烟。
- 人工冒烟需覆盖 Finder 同时拖入文本/图片/PDF、跨组内部标签拖动、关闭恢复后的冷启动，以及保存面板期间切换/编辑/关闭原标签。

## Self-Check: PASSED

- 九个计划源码文件均存在。
- `8ddd1ea`、`89ff7a2`、`04bf66e`、`2c6407b`、`59d6dc7` 和 `6adcb3f` 均存在于当前 Git 历史。
- SUMMARY 已创建；PLAN、SUMMARY、STATE 与 `install-backups/` 均未纳入源码提交。

---
*Phase: quick-260827-4ki-data-safety*
*Completed: 2026-08-27*
