---
phase: quick-260827-4ki-data-safety
verified: 2026-08-26T19:44:35Z
status: human_needed
score: 4/6 must-haves verified
overrides_applied: 0
human_verification:
  - test: "从 Finder 一次拖入文本、图片和 PDF，再进行内部标签跨组拖动、取消拖动和切换应用后的外部拖入。"
    expected: "三个外部路径按顺序生成对应文本或预览标签；内部拖动只移动私有 MIME 指定的标签，取消或失焦后不会误用旧 draggedTabId，也不会吞掉外部文件。"
    why_human: "Tauri Webview 原生 drag-drop 与 WebKit DataTransfer 的真实事件顺序和 Finder 路径只能在打包后的 macOS 应用中确认。"
  - test: "临时标签保存时切换标签；绑定文件保存期间继续编辑；另一次保存期间关闭目标标签。"
    expected: "只绑定最初触发保存的标签；保存写入触发瞬间的内容、编码和换行符；后续编辑保持 dirty；关闭标签不会被复活。"
    why_human: "保存面板和原生 IPC 的真实异步时序需要在应用内人为制造，纯函数检查不能证明系统对话框交互体验。"
  - test: "在设置中依次输入 D、Delete、F2 和 Cmd+D，并在编辑器中验证生效情况。"
    expected: "前三个裸键在保存设置前被拒绝，Cmd+D 被规范化并注册为 Monaco 的逐个选择相同内容命令。"
    why_human: "静态穷尽映射和编译检查能证明可注册性，但实际按键分发及与 Monaco 内建键位的冲突仍需真人输入。"
---

# Quick 260827-4ki：前端数据安全边界验证报告

**目标：** 关闭外部文件拖放、损坏恢复数据、关闭恢复启动顺序、异步保存竞态、快捷键验证漂移和内部拖放状态泄漏六类缺陷。
**验证时间：** 2026-08-26T19:44:35Z
**状态：** human_needed
**复验：** 否，首次验证；此前不存在 VERIFICATION.md。

## Goal Achievement

### Observable Truths

| # | 真值 | 状态 | 证据 |
|---|---|---|---|
| 1 | Finder 多文件由 Tauri 原生绝对路径逐个打开，HTML5 只处理私有 MIME 且不吞外部文件 | ? UNCERTAIN | `src/routes/+page.svelte:536` 注册 `onDragDropEvent`，`src/routes/+page.svelte:541` 只处理 drop，`src/routes/+page.svelte:543` 串行遍历全部 `payload.paths`；编辑组 HTML5 handler 在 `src/routes/+page.svelte:294` 先要求私有 MIME。源码已移除 `File.path` 和窗口级外部 drop/dragover，但 Finder/WebKit 真实事件需人工确认。 |
| 2 | 设置、标签和编辑组逐字段校验，损坏字段回退且整体损坏快照清除 | ✓ VERIFIED | `src/lib/session/model.ts:441` 重建全部设置字段；`src/lib/session/model.ts:499` 重建标签并拒绝非法必填字段、缺路径文件/预览；`src/lib/session/model.ts:534` 校验根、版本、tabs/groups、去重和修复组关系。`npm run check:session` 通过恶意字段、重复 ID、空快照和部分损坏回归。 |
| 3 | preserve=false 启动先删 SESSION_KEY，且不读取会话 | ✓ VERIFIED | `src/lib/session/storage.ts:29` 先读取 SETTINGS_KEY；`src/lib/session/storage.ts:31` 在 false 分支调用清理并直接返回，SESSION_KEY 读取仅位于后续 `src/lib/session/storage.ts:36`。`src/lib/session/selfcheck.ts:304` 的操作日志断言包含 remove 且不包含 SESSION_KEY get。 |
| 4 | 保存捕获触发瞬间字段，异步切换、编辑、关闭不误绑、不误清 dirty、不复活标签 | ? UNCERTAIN | `src/lib/session/save.ts:13` 冻结 tabId/content/encoding/lineEnding/title/filePath/kind；`src/lib/session/save.ts:25` 只按捕获 tabId 归并，三字段完全相等才清 dirty；`src/routes/+page.svelte:126` 在任何 await 前捕获，后续路径、invoke 和归并只使用 request。纯函数竞态自检通过，真实保存面板/IPC 时序需人工确认。 |
| 5 | 快捷键校验与 Monaco 注册共享契约，裸键拒绝且有限键映射穷尽 | ✓ VERIFIED | `src/lib/shortcuts.ts:10` 定义 86 个有限 `ShortcutKey`；`src/lib/shortcuts.ts:85` 统一解析并要求至少一个修饰键；`src/lib/editor/monaco.ts:38` 仅消费 `parseShortcut`。额外脚本将全部 86 个映射名与锁定 Monaco `KeyCode` 枚举交叉核对，missing=[]；`npm run check:shortcuts` 通过。 |
| 6 | draggedTabId 仅在私有 MIME 下回退，所有内部/原生结束边界清理状态，延迟监听自释放 | ✓ VERIFIED | `src/routes/+page.svelte:294` 无私有 MIME 立即拒绝；仅私有 MIME 存在时使用 transfer 或 draggedTabId，且再次检查标签存在。blur、dragend、内部 drop finally、原生 drop/leave、销毁分别在 `src/routes/+page.svelte:532`、`src/routes/+page.svelte:588`、`src/routes/+page.svelte:315`、`src/routes/+page.svelte:536`、`src/routes/+page.svelte:566` 清理；`src/routes/+page.svelte:544` 在 disposed 后 resolve 时立即 unlisten。 |

**Score:** 4/6 真值已由自动证据完全验证；2 项真实 macOS 交互待人工验收。

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `src/lib/session/model.ts` | 逐字段设置、标签、组与快照规范化 | ✓ VERIFIED | 存在、实质实现；无未验证对象 spread；由 storage、页面和自检使用。 |
| `src/lib/session/storage.ts` | 设置优先且 preserve=false 先删不读 | ✓ VERIFIED | 存在、实质实现；页面启动调用 `readStartupState(localStorage)`。 |
| `src/lib/session/save.ts` | 不可变 SaveRequest 与纯归并 | ✓ VERIFIED | 存在、实质实现；由 index 导出并由页面保存链调用。 |
| `src/lib/session/selfcheck.ts` | 恢复与保存竞态回归 | ✓ VERIFIED | 存在、实质实现；接入 `npm run check:session` 并实际通过。 |
| `src/lib/shortcuts.ts` | 有限联合和共享解析契约 | ✓ VERIFIED | 存在、实质实现；设置验证和 Monaco 注册共同消费。 |
| `src/lib/shortcuts.selfcheck.ts` | 裸键、全键集合、别名回归 | ✓ VERIFIED | 存在、实质实现；接入 `npm run check:shortcuts` 并实际通过。 |
| `src/routes/+page.svelte` | 原生/内部拖放、稳定启动和保存调用链 | ✓ VERIFIED | 存在、实质实现；上述四条关键链路均在页面运行入口接线。 |

`gsd-sdk query verify.artifacts` 结果：7/7 passed。

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `src/routes/+page.svelte` | `@tauri-apps/api/webview` | `getCurrentWebview().onDragDropEvent` | ✓ WIRED | drop.paths 串行进入现有 `openPath`；leave/drop 先清状态；销毁及晚到 resolve 均 unlisten。 |
| `src/routes/+page.svelte` | `src/lib/session/storage.ts` | `readStartupState(localStorage)` | ✓ WIRED | 页面启动不自行预读 SESSION_KEY，设置优先短路契约未被绕过。 |
| `src/routes/+page.svelte` | `src/lib/session/save.ts` | `captureSaveRequest` / `applySaveResult` | ✓ WIRED | 捕获发生在首个 await 前，归并基于最新 session 和稳定 tabId。 |
| `src/lib/shortcuts.ts` | `src/lib/editor/monaco.ts` | `parseShortcut` | ✓ WIRED | UI 持久化验证与 Monaco 注册没有第二套允许键列表。 |

`gsd-sdk query verify.key-links` 结果：4/4 verified。

### Data-Flow Trace

| Artifact | Data | Source | Real Data | Status |
|---|---|---|---|---|
| `src/routes/+page.svelte` | 外部文件路径 | Tauri Webview `event.payload.paths` | 是，逐个传给现有 `openPath` | ✓ FLOWING |
| `src/lib/session/storage.ts` | settings/session | 浏览器 localStorage | 是，unknown JSON 经反序列化后进入运行态 | ✓ FLOWING |
| `src/lib/session/save.ts` | SaveRequest | 当前活动 SessionTab 的触发瞬间快照 | 是，传给原生 `save_file` 并按 tabId 归并 | ✓ FLOWING |
| `src/lib/shortcuts.ts` | 自定义组合键 | 设置输入框 | 是，验证后持久化并由 Monaco 解析注册 | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| 恢复、启动短路、保存竞态纯函数 | `npm run check:session` | `Edgedor session self-check passed` | ✓ PASS |
| 快捷键接受集与解析契约 | `npm run check:shortcuts` | `Edgedor shortcut self-check passed` | ✓ PASS |
| Svelte/TypeScript 静态检查 | `npm run check` | 0 errors / 0 warnings | ✓ PASS |
| 前端生产构建 | `npm run build` | 构建成功；仅既有 Monaco 大 chunk 提示 | ✓ PASS |
| Rust 编译与单测 | `cargo check ... && cargo test ...` | 编译成功，11/11 tests passed | ✓ PASS |
| 86 个 ShortcutKey 对应 Monaco KeyCode | Node 枚举交叉核对 | `{\"mapped\":86,\"missing\":[]}` | ✓ PASS |
| 禁止旧 HTML5 外部文件路径方案 | `! rg -n "File & ...|openDroppedFile|onDragOver" src/routes/+page.svelte` | 无匹配 | ✓ PASS |
| 补丁空白检查 | `git diff --check` | 无输出，退出码 0 | ✓ PASS |

### Probe Execution

无计划声明 probe，`scripts/**/tests/probe-*.sh` 也不存在；本项跳过。

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| EDIT-10 | 260827-4ki | 图形化自定义组合键 | ✓ SATISFIED | 输入在 `src/routes/+page.svelte:144` 先校验，统一契约进入 Monaco；真实键盘体验列入人工验收。 |
| SESSION-02 | 260827-4ki | 标签跨组拖动 | ? NEEDS HUMAN | 私有 MIME、组移动和清理代码完整；真实 WebKit 拖动仍需人工确认。 |
| SESSION-08 | 260827-4ki | 版本化会话恢复 | ✓ SATISFIED | 逐字段反序列化、组关系修复、自检和启动接线均存在。 |
| SESSION-09 | 260827-4ki | 关闭恢复后内容不落盘 | ✓ SATISFIED | preserve=false 启动先删不读，设置变更和 checkpoint 也仅 remove。 |
| FILE-03 | 260827-4ki | 真实文件仅显式保存写回 | ? NEEDS HUMAN | `saveActive` 仅由保存动作触发且按快照写回；真实原生写入竞态需人工验收。 |
| FILE-04 | 260827-4ki | 临时标签保存后绑定路径 | ? NEEDS HUMAN | save dialog 路径和 `applySaveResult` 绑定逻辑完整；系统对话框体验需人工确认。 |
| FILE-07 | 260827-4ki | 一个或多个文件拖入 | ? NEEDS HUMAN | Tauri `payload.paths` 全量串行处理已接线；Finder 真机行为需人工验收。 |

REQUIREMENTS.md 中上述需求仍映射到既有 Phase 3/4/5；本 quick 是针对这些已实现能力的数据安全收敛，没有发现本 quick 新增但无人认领的 requirement。

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| `src/lib/session/model.ts` | 488 | `return {}` | ℹ️ Info | 非对象 editor 快照的安全回退，不是空实现。 |
| `src/lib/session/selfcheck.ts` | 360 | `console.log` | ℹ️ Info | 自检成功标记，由 npm 脚本消费，不是业务 handler。 |
| `src/lib/shortcuts.selfcheck.ts` | 53 | `console.log` | ℹ️ Info | 自检成功标记，不是业务实现。 |

未发现 TBD、FIXME、XXX、TODO、HACK、PLACEHOLDER、占位 UI、空业务 handler 或未接线实现。

### Confirmation-Bias Counter

- **部分验证项：** Finder/WebKit 拖放和系统保存面板的真实事件顺序只能由人工验证，因此没有把自动检查通过等同于完整用户行为通过。
- **可能误导的测试：** 快捷键自检原本只断言自身映射表含目标；本次额外把 86 个映射值与锁定 Monaco `KeyCode` 枚举交叉核对，未发现缺失。
- **未自动覆盖的错误路径：** `onDragDropEvent` 注册失败仅记录 console error，缺乏可注入的自动测试；这不破坏正常路径 must-have，但人工测试应在打包应用中确认监听确实注册。

### Commit Verification

`8ddd1ea`、`89ff7a2`、`04bf66e`、`2c6407b`、`59d6dc7`、`6adcb3f` 均通过 `git cat-file -e <hash>^{commit}`，且修改范围与计划三项任务一致。

### Human Verification Required

#### 1. Finder 与内部标签拖放隔离

**Test:** 从 Finder 同时拖入文本、图片和 PDF；跨组拖内部标签；取消拖动、切换应用后再次拖入外部文件。
**Expected:** 外部文件按顺序打开；仅私有 MIME 标签移动；残留状态不误移动旧标签，也不阻止外部文件。
**Why human:** 依赖真实 macOS Finder、Tauri Webview 和 WebKit DataTransfer 联合行为。

#### 2. 保存对话框竞态

**Test:** 保存临时标签时切换标签；写入期间继续编辑；另一次保存期间关闭目标标签。
**Expected:** 只写入并绑定捕获标签；后续编辑保持 dirty；关闭标签不复活。
**Why human:** 需要真实系统保存面板和 IPC 延迟。

#### 3. 自定义快捷键实际分发

**Test:** 设置 D、Delete、F2、Cmd+D，并在编辑器中触发。
**Expected:** 裸键均被拒绝，Cmd+D 成功执行逐个选择相同内容。
**Why human:** 需要确认 Monaco 与 WebView 的实际键盘事件分发和冲突优先级。

### Gaps Summary

没有发现代码级阻断缺口。六个目标边界都存在实质实现并完成接线；其中恢复、启动短路、快捷键契约和拖动状态授权可由源码与自动检查完整证明。Finder 原生拖放、WebKit 内部拖动和系统保存对话框的真实交互仍需 macOS 人工冒烟，因此总体状态按规则为 `human_needed`，不能标记 `passed`。

---

_Verified: 2026-08-26T19:44:35Z_
_Verifier: Codex（gsd-verifier）_
