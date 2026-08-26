---
phase: quick-260827-31h-editor-groups
verified: 2026-08-26T18:38:43Z
status: human_needed
score: 7/7 must-haves verified
overrides_applied: 0
human_verification:
  - test: "创建四组后再次点击分区，并在横排、竖排两种方向拖动全部三条分隔条，包括触发 pointercancel 和 lostpointercapture。"
    expected: "第五组被拒绝且布局不变；每次只改变相邻两组，比例不越过最小值；取消或丢失捕获后立即停止并可重新拖动。"
    why_human: "真实 Pointer Events、pointer capture 和触控行为需要在 macOS WebView 中验证。"
  - test: "仅用键盘聚焦三条分隔条，分别使用方向键、Home 和 End。"
    expected: "方向键按相邻组总权重的 2% 调整，Home/End 到合法边界，ARIA 数值随之更新。"
    why_human: "焦点顺序、按键事件和辅助功能反馈需要真实界面验证。"
  - test: "把临时、真实文件和图片/PDF 预览标签拖到第一、中间、末尾及空组。"
    expected: "目标组激活，标签种类、内容、文件绑定和预览数据不变，不触发外部文件打开。"
    why_human: "浏览器 DataTransfer、Monaco/预览组件重挂载和视觉激活需真实拖放验证。"
  - test: "取消一次内部标签拖动后，立即从 Finder 拖入文本文件、图片或 PDF。"
    expected: "内部状态已清理，外部文件 drop 继续冒泡并由现有文件打开流程处理。"
    why_human: "dragend/cancel 与下一次 Finder drop 的事件顺序无法通过静态检查可靠模拟。"
  - test: "调整为不等比例并切换方向/活动组，先切换标签或隐藏面板形成合法检查点，再重启应用。"
    expected: "组顺序、比例、统一方向、标签归属和活动组完整恢复；仅拖动比例时不立即写入会话快照。"
    why_human: "跨 WebView 生命周期、localStorage 与真实应用重启的组合行为需要端到端确认。"
---

# Quick 260827-31h：扩展为四个可调编辑组验证报告

**阶段目标：** 在单窗口、扁平统一方向布局中支持最多四个可调编辑组、相邻分隔条和任意组间标签拖放，并可靠迁移与恢复旧会话。
**验证时间：** 2026-08-26T18:38:43Z
**状态：** human_needed
**复验：** 否，初次验证

## 目标达成情况

### 可观察真值

| # | 真值 | 状态 | 证据 |
|---|---|---|---|
| 1 | 单窗口工作区最多四组，第五组拒绝且状态不变 | ✓ VERIFIED | `MAX_EDITOR_GROUPS=4`；`createGroup` 达上限直接返回原对象（`src/lib/session/model.ts:212`）；页面显示上限提示（`src/routes/+page.svelte:270`）；自检验证四组与第五次返回同一状态（`src/lib/session/selfcheck.ts:89`）。 |
| 2 | 创建组在活动组后对半分；删除组交给视觉相邻组并遵守活动/非活动语义 | ✓ VERIFIED | 创建插入与对半分在 `src/lib/session/model.ts:212`；删除优先右邻、末组左邻并迁移标签/活动标签在 `src/lib/session/model.ts:229`；活动中间组、非活动组、活动末组均有断言（`src/lib/session/selfcheck.ts:107`）。 |
| 3 | 分隔条支持 pointer 与键盘，只调整相邻两组 | ✓ VERIFIED | 纯模型只改 separatorIndex 两侧（`src/lib/session/model.ts:264`）；pointer 路径和键盘路径均调用该函数（`src/routes/+page.svelte:322`、`src/routes/+page.svelte:359`）；额外反例探针验证非相邻比例保持不变。 |
| 4 | 比例有限、正数、和为 1、满足最小值，并可在合法检查点后恢复 | ✓ VERIFIED | 集中规范化在 `src/lib/session/model.ts:184`；序列化保存规范化权重（`src/lib/session/model.ts:382`）；方向/比例只用 `applySession`，隐藏与退出走 checkpoint（`src/routes/+page.svelte:275`、`src/routes/+page.svelte:530`）；自检覆盖比例和与往返恢复。 |
| 5 | 临时、文件、预览标签均可移入任意组，目标激活且内容不变 | ✓ VERIFIED | `moveTabToGroup` 对所有 `TabKind` 使用同一路径，只改归属、焦点时间和活动引用；页面所有组（包括空组）均为 drop target（`src/routes/+page.svelte:569`）；额外模型探针对三种标签逐字段验证内容与元数据不变。 |
| 6 | 0 组、5+ 组及失效活动引用的快照被确定性修复 | ✓ VERIFIED | 反序列化重建空组、截断并归并溢出组、修复 tab/group/active 引用及旧比例方向（`src/lib/session/model.ts:437`）；自检覆盖空组、六组、孤儿标签、非法方向和活动引用（`src/lib/session/selfcheck.ts:147`）；额外探针验证同一损坏输入结果确定。 |
| 7 | 取消分隔条或标签拖动会清理状态，不阻止后续外部文件 drop | ✓ VERIFIED | pointer up/cancel/lost capture 共用幂等清理并释放 capture（`src/routes/+page.svelte:317`、`src/routes/+page.svelte:347`）；dragend、成功 drop、组件销毁清理内部 tabId（`src/routes/+page.svelte:284`、`src/routes/+page.svelte:304`、`src/routes/+page.svelte:540`）；仅有效私有 MIME/当前有效 tabId 才 preventDefault/stopPropagation（`src/routes/+page.svelte:292`）。 |

**得分：7/7 条真值已由代码与自动检查支持。**

## 必需产物

| 产物 | 预期 | 状态 | 详情 |
|---|---|---|---|
| `src/lib/session/model.ts` | 四组模型、比例不变量、迁移与修复 | ✓ VERIFIED | 存在且实质完整；导出计划要求的常量与函数；被页面和自检实际调用。 |
| `src/lib/session/selfcheck.ts` | 四组、删除、损坏快照、恢复自动自检 | ✓ VERIFIED | `npm run check:session` 实际执行通过；不是孤立测试，直接导入生产模型与 storage。 |
| `src/routes/+page.svelte` | 统一布局、分隔条、标签拖放、checkpoint 接线 | ✓ VERIFIED | 一至四组由同一 each 渲染；pointer、键盘、拖放与持久化边界均接入生产页面。 |
| `src/lib/i18n.ts` | 四组上限与 separator 无障碍中英文文案 | ✓ VERIFIED | 中英文均包含四组提示、分隔条标签及键盘提示，并被页面 `t(...)` 使用。 |

`gsd-sdk query verify.artifacts` 返回 4/4 passed。

## 关键链路验证

| 来源 | 目标 | 方式 | 状态 | 详情 |
|---|---|---|---|---|
| `src/routes/+page.svelte` | `src/lib/session/model.ts` | pointer/键盘 → `resizeAdjacentGroups` | ✓ WIRED | 两条交互路径均只调用模型函数，页面未复制比例归一化算法。 |
| `src/routes/+page.svelte` | `src/lib/session/storage.ts` | `applySession` 内存更新 → 后续 `checkpoint` | ✓ WIRED | 比例、方向不直接写盘；活动位置改变、面板隐藏和退出触发既有 checkpoint。 |
| `src/lib/session/model.ts` | 旧 SESSION_VERSION=1 快照 | `deserializeSession` 迁移/修复 | ✓ WIRED | 旧 child ratio 转扁平权重；0/5+ 组与失效引用都进入确定性修复路径。 |
| 内部标签 drop target | 窗口级外部文件 drop | 私有 MIME/有效 tab 白名单分流 | ✓ WIRED | 内部事件才停止传播；普通外部 drop 留给 window handler。 |

`gsd-sdk query verify.key-links` 返回 4/4 verified。

## 数据流追踪（Level 4）

| 产物 | 数据 | 来源 | 真实数据流 | 状态 |
|---|---|---|---|---|
| 工作区组布局 | `session.groups[].splitRatio`、`splitOrientation` | 反序列化或模型操作 | Svelte `each` → `groupStyle`/flex direction → separator ARIA | ✓ FLOWING |
| 编辑组内容 | `group.activeTabId` → `SessionTab` | 会话恢复、标签激活或跨组移动 | `groupTab` → `EditorSurface`/`PreviewSurface` | ✓ FLOWING |
| 恢复状态 | 序列化后的 groups、方向、activeGroupId | 合法 checkpoint 写入 `edgedor.session` | 启动读取 → `deserializeSession` → 页面 session | ✓ FLOWING |

## 行为抽查

| 行为 | 命令 | 结果 | 状态 |
|---|---|---|---|
| 会话模型与损坏快照自检 | `npm run check:session` | `Edgedor session self-check passed` | ✓ PASS |
| Svelte/TypeScript 类型与可访问性检查 | `npm run check` | 0 errors, 0 warnings | ✓ PASS |
| 生产构建 | `npm run build` | adapter-static 成功生成 `build` | ✓ PASS |
| 四组上限、相邻比例、三种标签内容、确定性修复额外探针 | `node --experimental-strip-types --input-type=module ...` | `targeted editor-group probes passed` | ✓ PASS |
| 提交与补丁空白检查 | `git show --check ...`、`git diff 9c2bc9d^..984793e --check` | 退出码 0 | ✓ PASS |

## Probe 执行

本 quick plan 未声明 probe，仓库也没有匹配 `scripts/*/tests/probe-*.sh` 的常规 probe，因此跳过。

## 需求覆盖

此 quick plan 的 `requirements-completed` 为空，PLAN frontmatter 也未声明需求 ID；无可交叉引用的 REQUIREMENTS ID，未发现孤立需求声明。

## 反模式检查

| 文件 | 行 | 模式 | 严重度 | 影响 |
|---|---|---|---|---|
| 四个改动文件 | — | 未发现 TBD/FIXME/XXX、空实现或用户可见 placeholder stub | ℹ️ Info | 无阻塞。 |
| `src/lib/session/selfcheck.ts` | — | 自动自检不模拟浏览器 PointerEvent/DataTransfer | ⚠️ Warning | 测试通过不能证明真实 pointer capture、drag cancellation 与 Finder drop 事件顺序，已列为人工验证。 |

构建仅报告 Monaco 主 chunk 大于 500 kB 的既有 Vite 警告，不影响本 quick task 的功能目标。

## 反证检查

- **可能的部分覆盖：** 自动检查未覆盖浏览器 pointer capture 与 Finder DataTransfer，故不能仅凭 selfcheck 宣布交互已完成人工验收。
- **可能误导的通过测试：** `npm run check:session` 充分验证纯模型，但不执行 Svelte 事件处理器；因此单独依赖该结果会高估 UI 行为可信度。
- **未自动覆盖的错误路径：** `pointercancel`/`lostpointercapture` 后立即再次拖动，以及内部 dragend 后紧接外部文件 drop 的真实事件顺序，需要人工验证。

## 人工验证要求

### 1. 四组上限与 pointer 分隔条

**测试：** 创建四组后再点一次分区；横排、竖排分别拖动全部分隔条，并主动触发 pointercancel/lostpointercapture。
**预期：** 第五组被拒绝且状态不变；只调整相邻组；最小比例生效；取消后停止且能立刻重新拖动。
**为何需人工：** macOS WebView 的 pointer capture 与触控事件需真实运行态确认。

### 2. 键盘 separator

**测试：** 聚焦三条 separator，使用对应方向键、Home、End。
**预期：** 每次按相邻组总权重 2% 调整，Home/End 到合法边界，ARIA 数值同步。
**为何需人工：** 焦点、键盘和辅助功能反馈不可由当前静态自检覆盖。

### 3. 三种标签跨组拖放

**测试：** 将临时、真实文件、图片/PDF 预览标签拖入第一、中间、末尾和空组。
**预期：** 目标组激活；标签内容、文件绑定、预览不变；不误触发外部打开。
**为何需人工：** 真实 DataTransfer 与组件重挂载需界面验证。

### 4. 取消内部拖动后外部文件 drop

**测试：** 取消标签拖动后，立即从 Finder 拖入文本、图片或 PDF。
**预期：** 外部文件仍正常打开，未被残留内部状态吞掉。
**为何需人工：** 两次拖动间的浏览器事件顺序无法静态证明。

### 5. 合法 checkpoint 后重启恢复

**测试：** 调整比例、方向、活动组后，切换标签或隐藏面板，再重启。
**预期：** 组顺序、比例、方向、标签归属和活动组恢复；普通比例拖动本身不立即写盘。
**为何需人工：** 需要真实 localStorage 生命周期与应用重启。

## 缺口摘要

未发现代码级 blocker 或未接线产物。全部 7 条 must-have 已有实质实现、生产接线和自动验证证据；由于计划明确包含真实 macOS Pointer Events、键盘无障碍、Finder 拖放及跨重启恢复的人工检查，本阶段按决策树标记为 `human_needed`，不能标记为 `passed`。

---

_验证时间：2026-08-26T18:38:43Z_
_验证者：Codex（gsd-verifier）_
