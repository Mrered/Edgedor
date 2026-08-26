---
phase: quick-260827-59g-monaco
verified: 2026-08-26T20:11:34Z
status: human_needed
score: 3/4 must-haves verified
overrides_applied: 0
human_verification:
  - test: "在打包应用同一标签输入至少三步可区分文本，依次切换标签、自动/手动切换语言、字号和四项显示设置、VS Code/Sublime/JetBrains/Vim 及自定义覆盖，每步后执行撤销与重做；最后关闭并恢复标签。"
    expected: "所有配置变化后旧撤销链连续；Vim 进出和快捷键重配无重复触发；关闭后恢复内容但不继承已释放 model 的旧撤销栈。"
    why_human: "真实 Monaco editor、monaco-vim 键位处理和 Svelte 组件重挂载的组合行为无法由现有 Node 自检覆盖。"
---

# Quick 260827-59g：持久化 Monaco Model 与撤销历史验证报告

**目标：** 每个存活标签以 `tab.id` 复用 Monaco model，在语言、视图和快捷键/Vim 动态变化后保留撤销历史，并在标签或应用生命周期结束时正确回收。
**验证时间：** 2026-08-26T20:11:34Z
**状态：** human_needed
**复验：** 否，首次验证

## 目标达成情况

### 可观察事实

| # | 事实 | 状态 | 证据 |
|---|---|---|---|
| 1 | 同一标签在切换标签、语言、字号、显示设置、快捷键方案后仍可连续撤销/重做 | ? UNCERTAIN | `EditorSurface.svelte:40-58` 原地执行 `updateOptions`、语言更新和快捷键重配；`+page.svelte:613` 仅以 `tab.id` 为 key。实现链路成立，但真实应用组合冒烟尚未在本次验证执行。 |
| 2 | 每个未关闭标签只复用以 `tab.id` 为键的 model，不同标签互不串扰 | ✓ VERIFIED | `modelRegistry.ts:15-37` 用私有 `Map` 按 tab ID 创建/复用；`EditorSurface.svelte:60-64` 以 `tab.id` 获取 model；fake 自检验证同 ID 严格同对象并通过。 |
| 3 | 关闭、过期、清空和销毁释放 model；移动、合并分组、设置重置不误释放 | ✓ VERIFIED | `+page.svelte:65-68` 所有 `applySession` 后按完整 `tabs` 存活集合 retain；关闭、启动/定时过期、清空均走该入口（86-90、256-259、496-501、523）；移动/分组合并/设置重置保留 tabs（267、288、320）；销毁时 `disposeAll`（579）。selfcheck 验证单次释放与幂等全清。 |
| 4 | 自动语言、外部内容和 model 回传不递归；外部差异作为一个可撤销全文 edit 保留旧历史 | ✓ VERIFIED | `EditorSurface.svelte:49-69` 值比较、同步抑制和正常回传明确；`monaco.ts:17-20` 使用两侧 `pushStackElement` 包裹 `pushEditOperations`，全仓无既有 model 的 `setValue`。本轮在 Vite 1420 入口运行真实 Monaco 探针，读取 dataset 得到精确结果 `PASS Monaco model undo/redo and suppression probe`。 |

**得分：3/4 个事实已自动验证；其余 1 项等待打包应用真实交互验证。**

## 必需产物

| 产物 | 预期 | 状态 | 详情 |
|---|---|---|---|
| `src/lib/editor/modelRegistry.ts` | tab ID registry 与同步/回收 API | ✓ VERIFIED | 75 行实质实现；创建、等值跳过、语言更新、retain、单个/全量释放均存在。 |
| `src/lib/editor/modelRegistry.selfcheck.ts` | 无 DOM 生命周期自检 | ✓ VERIFIED | 51 行；覆盖同 ID 复用、等值跳过、差异替换、语言身份保持、单次回收、幂等全清。 |
| `src/lib/editor/monacoModel.probe.ts` | 真实 Monaco undo/redo 与 suppression 探针 | ✓ VERIFIED | 61 行；直接导入 `monaco-editor`，执行两次用户 edit、一次外部 edit、三次 undo/redo，并断言未抑制回调为 0；本轮浏览器执行返回精确 PASS。 |
| `src/components/EditorSurface.svelte` | 短生命周期 editor view 与动态重配 | ✓ VERIFIED | registry model 注入 editor；卸载只释放 Vim、快捷键、订阅和 editor，不直接 dispose model。 |
| `src/routes/+page.svelte` | 稳定 key、会话回收边界和全量销毁 | ✓ VERIFIED | `#key tab.id`、中央 `applySession/retain`、销毁 `disposeAll` 和开发探针入口均已连接。 |

`gsd-sdk query verify.artifacts` 返回 5/5 通过。提交 `d12c188` 与 `bb082e3` 均存在且是当前 `HEAD` 的祖先，修改范围与 PLAN 列表一致。

## 关键连接验证

| 来源 | 目标 | 方式 | 状态 | 详情 |
|---|---|---|---|---|
| `EditorSurface.svelte` | `modelRegistry.ts` | 通过 `monaco.ts` 导出的生产 registry，按 `tab.id` 获取 | ✓ WIRED | 属于间接导入：`EditorSurface -> monaco.ts -> TabModelRegistry`。SDK 因只做目标文件名直连匹配而报未引用，人工追踪确认实际连接。 |
| `+page.svelte` | `modelRegistry.ts` | `applySession` retain 与销毁 disposeAll | ✓ WIRED | 同样通过 `monaco.ts` 的 `editorModelRegistry` 间接连接；所有 session 赋值集中在 `applySession`。 |
| `EditorSurface.svelte` | `+page.svelte` | `onChange` 回传与 prop 外部同步 | ✓ WIRED | model 正常变更调用 `onChange(currentEditor.getValue())`；父层 `editContentFor` 更新对应 tab；外部差异同步时 suppression 阻断回传。 |

## 数据流追踪

| 产物 | 数据 | 来源 | 真实流动 | 状态 |
|---|---|---|---|---|
| `EditorSurface.svelte` | `tab.content` | session 中对应 `tab.id` | `getOrCreate` 初始注入；后续差异经 `syncExternalContent` 全文 edit；用户输入经 `onChange -> editContentFor -> applySession` 回传 | ✓ FLOWING |
| `EditorSurface.svelte` | `tab.language` | 自动检测或状态栏手选 | registry `setLanguage -> monaco.editor.setModelLanguage`，不替换 model | ✓ FLOWING |
| `EditorSurface.svelte` | 视图/快捷键设置 | `session.settings` props | `updateOptions` 与 disposable action/Vim 重注册原地生效 | ✓ FLOWING（运行感受待人工） |

## 行为检查

| 行为 | 命令 | 结果 | 状态 |
|---|---|---|---|
| registry 生命周期 | `npm run check:editor-models` | `PASS model registry lifecycle self-check` | ✓ PASS |
| 快捷键纯逻辑 | `npm run check:shortcuts` | `Edgedor shortcut self-check passed` | ✓ PASS |
| 会话操作 | `npm run check:session` | `Edgedor session self-check passed` | ✓ PASS |
| Svelte/TypeScript | `npm run check` | 0 errors / 0 warnings | ✓ PASS |
| 前端构建与 SSR 边界 | `npm run build` | adapter-static 构建成功；`+layout.ts` 明确 `ssr = false` | ✓ PASS |
| Rust 回归 | `cargo check`、`cargo test` | check 成功，11/11 tests 通过 | ✓ PASS |
| 补丁格式 | `git diff d12c188^..bb082e3 --check`、`git diff --check` | 无输出，退出 0 | ✓ PASS |

## 探针执行

| 探针 | 命令/入口 | 结果 | 状态 |
|---|---|---|---|
| fake registry 自检 | `npm run check:editor-models` | PASS | ✓ PASS |
| 真实 Monaco 浏览器探针 | `http://127.0.0.1:1420/?editor-model-probe=1` | `document.documentElement.dataset.editorModelProbe` 精确为 `PASS Monaco model undo/redo and suppression probe`；执行后浏览器与服务均已关闭 | ✓ PASS |

## 要求覆盖

此 quick PLAN 的 `requirements-completed` 为空，也未声明正式 requirement ID；不存在需交叉核对的 REQUIREMENTS 条目。

## 反模式与反证检查

| 文件/范围 | 检查 | 严重度 | 结论 |
|---|---|---|---|
| 7 个计划文件 | `TODO/FIXME/XXX/HACK/PLACEHOLDER`、空实现、`setValue`、遗留 `addCommand` | ℹ️ Info | 未发现阻塞标记、空壳、既有 model `setValue` 或不可释放命令注册。 |
| `modelRegistry.selfcheck.ts` | fake 是否能证明真实 Monaco undo service | ℹ️ Info | 不能；该测试只证明 registry 调用契约，但本轮真实 Monaco 浏览器探针已经补足 undo service 与 suppression 的运行证据。 |
| `monaco.ts` / `EditorSurface.svelte` | disposable 快捷键与 Vim 错误路径 | ⚠️ Warning | 源码先 dispose 再注册，但没有自动测试模拟频繁切换后是否出现重复触发，需在应用中冒烟。 |
| 构建产物 | bundle 大小警告 | ℹ️ Info | Monaco 主 chunk 约 3.64 MB，属于性能提示，不阻塞本 quick 的生命周期目标。 |

## 需要人工验证

### 1. 打包应用撤销链与动态重配

**测试：** 在同一标签完成多步编辑，然后依次切换标签、语言、字号、显示设置、四套快捷键和自定义覆盖，每步验证撤销/重做；再关闭并恢复标签。

**预期：** 存活标签撤销链连续，无快捷键重复执行；关闭后恢复内容但创建新 model，不继承关闭前撤销栈。

**原因：** 这是 Monaco、monaco-vim、Svelte 重挂载和 macOS WebView 的真实组合行为，静态分析与 Node fake 不能完全替代。

## 结论

源码层面的 registry、外部同步、动态配置、回收边界、SSR 边界和提交范围均符合 PLAN，没有发现阻塞性缺口。真实 Monaco 探针已在本轮浏览器执行中精确返回 PASS；由于打包应用中的标签切换、动态显示设置、四套快捷键/Vim 和关闭恢复仍需真实交互冒烟，状态保持 `human_needed`，不能判定 `passed`。

---

_验证时间：2026-08-26T20:11:34Z_
_验证者：gsd-verifier_
