# Architecture Research

**Domain:** macOS 原生侧边浮层 + Web 编辑器
**Researched:** 2026-08-26
**Confidence:** MEDIUM

## Standard Architecture

```
┌──────────────────────────────────────────────────────────────┐
│ macOS / AppKit 原生层                                         │
│ NSPanel · 多屏边缘检测 · 权限 · Liquid Glass · Quick Look     │
└───────────────────────────┬──────────────────────────────────┘
                            │ Tauri commands/events
┌───────────────────────────┴──────────────────────────────────┐
│ Rust 应用服务层                                                │
│ 单实例 · 文件/编码 · 恢复快照 · 寿命清理 · 更新 · 设置         │
└───────────────────────────┬──────────────────────────────────┘
                            │ typed invoke/events
┌───────────────────────────┴──────────────────────────────────┐
│ Svelte 5 UI                                                    │
│ 工具栏 · 标签/编辑组 · 设置 · 状态栏 · Quick Look 容器         │
└───────────────────────────┬──────────────────────────────────┘
                            │ model/commands
┌───────────────────────────┴──────────────────────────────────┐
│ Monaco 编辑器实例                                               │
│ 文本模型 · 光标/选区 · keybinding service · 搜索/语言高亮        │
└──────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| Native panel bridge | 单窗口、层级、动画、屏幕和全局事件 | Swift/AppKit 通过 Tauri 原生命令/事件桥接 |
| Rust session service | 标签、编辑组、快照、寿命和撤销槽 | serde 数据模型 + 应用私有目录 |
| File service | 编码检测、读写、路径绑定、20 MB 限制 | Rust `std::fs` + `encoding_rs` |
| Svelte workbench | 布局、工具栏、标签、设置和状态展示 | Svelte stores/runes + typed Tauri invoke |
| Monaco adapter | 生命周期、模型 URI、编辑器状态与 keymap | 每个文档一个 Monaco model，编辑器实例按组管理 |
| Preview bridge | 在原生 view 中显示 Quick Look | `QLPreviewView`，通过 opaque preview handle 与 Svelte 同步 |

## Recommended Project Structure

```
src/
├── lib/
│   ├── model/             # Tab, group, snapshot, settings types
│   ├── stores/            # Svelte 5 state and derived selectors
│   ├── editor/            # Monaco setup, keymaps, model registry
│   ├── commands/          # command palette and shortcut registry
│   └── tauri/              # typed invoke/event wrappers
├── components/
│   ├── chrome/             # Liquid Glass toolbar, tabs, status bar
│   ├── workbench/          # groups, splitters, empty state
│   ├── settings/           # settings screens
│   └── preview/            # Quick Look placeholder/container
└── app.html
src-tauri/
├── src/
│   ├── commands/           # file, session, settings, updater commands
│   ├── domain/             # serializable Rust domain model
│   ├── persistence/        # atomic snapshot read/write and expiry
│   ├── macos/              # native bridge boundary
│   └── lib.rs
└── capabilities/
native/
└── EdgedorPanel/           # Swift/AppKit target or static bridge
.github/workflows/release.yml
```

### Structure Rationale

- 前端只通过 typed wrappers 调用 Rust，不在组件中散落文件和窗口副作用。
- Rust domain model 是恢复快照的事实基础；Monaco model 是运行时缓存，不作为持久化格式。
- 原生层保持小而明确：窗口、权限、屏幕和 Quick Look；不要把业务状态复制一份到 Swift。

## Architectural Patterns

### Pattern 1: Serializable Session Model

**What:** 用版本化 JSON 快照描述 tabs、groups、active group、编辑器状态、settings 和绑定路径。
**When to use:** 每次切换标签、隐藏面板和正常退出时原子写入。
**Trade-offs:** 恢复可靠、易调试；需要处理快照版本迁移。

### Pattern 2: Command/Event Boundary

**What:** UI 用 invoke 请求动作，Rust 用事件通知面板状态和文件打开请求。
**When to use:** 原生边缘事件、Finder open-with、面板切换、更新状态。
**Trade-offs:** 边界清楚；类型定义需要前后端同步。

### Pattern 3: Model Registry per Tab

**What:** 一个标签对应一个 Monaco `ITextModel`，编辑组只持有 editor view 与 model 引用。
**When to use:** 标签跨组拖动、关闭/撤销和布局恢复。
**Trade-offs:** 大量标签消耗内存；24 小时与关闭时要及时 dispose。

## Data Flow

### Activation Flow

```
NSEvent/CGEvent → modifier+edge matcher → Rust/native event →
display lock → NSPanel frame animation → Svelte focus → Monaco focus
```

### Persistence Flow

```
tab/group mutation → dirty session flag → hide/switch/quit boundary →
Rust serialize/version/checksum → atomic temp+rename → restore on launch
```

### File Flow

```
Finder/drag/paste → Rust type/size/encoding check →
editable tab or Quick Look tab → explicit ⌘S → bound path overwrite
```

## Anti-Patterns

### Anti-Pattern 1: Web-only global panel

**What people do:** 只用 Tauri 默认窗口和 CSS 做贴边。
**Why it's wrong:** 无法稳定覆盖全屏空间、监听其他应用事件或实现真正的 `NSPanel` 层级。
**Do this instead:** 尽早做最小原生 panel spike，再扩展 UI。

### Anti-Pattern 2: 将恢复内容存在 Monaco 内部

**What people do:** 退出时从编辑器 DOM 或 view state 猜测文档。
**Why it's wrong:** model 生命周期、worker 和多组布局会造成丢失或重复。
**Do this instead:** Rust session model 作为唯一持久化源，Monaco 只做运行时视图。

## Integration Points

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Swift/AppKit ↔ Rust | Tauri command/event 或 C ABI shim | 先验证 `NSPanel` 与 WebView 嵌入方式，失败时保留可退化普通窗口 |
| Rust ↔ Svelte | typed invoke/events | 不把任意路径和原始事件直接暴露给前端 |
| Rust ↔ filesystem | 本地 API | 20 MB、编码、原子保存、路径失效需统一处理 |
| GitHub Release ↔ updater | HTTPS + Tauri 签名 | 公钥随应用发布，私钥只在 Actions Secret |

## Sources

- https://v2.tauri.app/start/prerequisites/
- https://v2.tauri.app/plugin/single-instance/
- https://v2.tauri.app/plugin/updater/
- https://developer.apple.com/documentation/appkit/nspanel
- https://developer.apple.com/documentation/appkit/nsglasseffectview
- https://developer.apple.com/documentation/quicklookui/qlpreviewview
- https://developer.apple.com/documentation/appkit/nsevent/addglobalmonitorforevents(matching:handler:)

---
*Architecture research for: Edgedor*
*Researched: 2026-08-26*
