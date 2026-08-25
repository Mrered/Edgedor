# Stack Research

**Domain:** macOS 临时代码编辑器与侧边浮层
**Researched:** 2026-08-26
**Confidence:** MEDIUM

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Tauri | 2.x（当前 CLI 2.11.4，API 2.11.1） | macOS 应用壳、Rust/WebView 通信、打包 | 小体积、原生窗口能力和 Rust 命令边界适合单实例工具 |
| Svelte | 5.56.x | 工具栏、标签、设置等 UI | 低运行时开销，状态驱动界面简单 |
| TypeScript | 当前稳定版 | 前端类型安全 | Monaco 和 Tauri API 都有成熟类型 |
| Monaco Editor | 0.56.x | VS Code 同源编辑器内核 | 直接提供多光标、列选择、折叠、查找替换和编辑命令 |
| Rust stable | 当前稳定版 | 状态、文件、单实例、更新和 Tauri 命令 | Tauri 官方默认路径；避免把文件与权限逻辑放进 WebView |
| Swift/AppKit | Xcode 26 / Swift 6.3 | `NSPanel`、Liquid Glass、Quick Look、全局事件 | macOS 26 API 的公开入口，复杂窗口行为不能只靠 CSS |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@tauri-apps/plugin-updater` | 2.10.x | 更新检查与安装 | Phase 6；更新包签名是强制的 |
| `tauri-plugin-single-instance` | Tauri 2.x | 严格单实例与传递打开文件参数 | Phase 1/5；优先采用官方插件/同版本 Rust crate |
| `@tauri-apps/plugin-dialog` | 2.7.x | 打开、保存路径选择 | Phase 5 |
| `@tauri-apps/plugin-fs` | 2.5.x | 受控文件读写 | Phase 5；限制路径与文件大小 |
| `monaco-vim` | 0.4.4 | Vim 键位层 | Phase 3；只实现编辑区 Vim，不承诺完整 Vim 生态 |
| `iconv-lite` / `jschardet` | 0.7.x / 3.1.x | 常见文本编码检测与转换 | Phase 5；最终保存编码由 Rust 保真处理 |
| `encoding_rs` | 当前 Rust stable 兼容版 | Rust 侧 UTF-16/GB18030 等编码 | Phase 5；避免前端大文件转码 |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Node.js + npm | 前端依赖与构建 | 当前环境 Node 26.7.0 / npm 11.19.0；以项目锁文件为准 |
| Vite | Svelte 开发服务器和打包 | 当前 registry 版本 8.2.2；由 Tauri Svelte 模板锁定 |
| Xcode 26 | macOS SDK、Swift 编译和 DMG 构建 | Tauri macOS 前置依赖；当前环境 Xcode 26.6 |
| GitHub Actions + `tauri-apps/tauri-action` | Apple Silicon 构建、Release、更新清单 | 使用公开 Release 和 Actions Secret 保存 updater 私钥 |

## Installation

```bash
npm create tauri-app@latest . -- --template svelte-ts
npm install monaco-editor monaco-vim jschardet iconv-lite
npm install @tauri-apps/plugin-updater @tauri-apps/plugin-dialog @tauri-apps/plugin-fs
```

Rust 原生插件版本必须和 Tauri 2 主版本保持一致，由 Phase 1 的 lockfile 和编译结果最终确定；当前机器尚未安装 `rustc/cargo`，开工前需安装 rustup 与 Xcode 命令行组件。

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Tauri 2 | Electron | 需要跨平台 Node 生态或现成 Electron 模块时 |
| Monaco | CodeMirror 6 | 追求极小体积或完全自定义编辑协议时 |
| Svelte 5 | React | 团队已有 React 组件库或 Monaco React 封装优先时 |
| AppKit `NSPanel` | 普通 Tauri WebviewWindow | 只需要普通窗口、不需要跨应用浮层时 |
| `QLPreviewView` | 自行解析 PDF/Office | 需要特殊标注或脱离系统 Quick Look 时 |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Electron | 体积和常驻内存不符合轻量侧边工具 | Tauri 2 |
| 普通 HTML `position: fixed` 伪装全局面板 | 不能跨应用、不能覆盖全屏空间 | 原生 `NSPanel` + Tauri 内容 |
| 自行实现全部文件预览器 | 格式解析和安全边界过大 | `QLPreviewView` |
| 直接依赖 VS Code 工作台源码 | 许可、体积和架构远超需求 | Monaco 编辑器 API |
| 未签名的 Tauri 更新包 | Tauri Updater 强制校验签名 | GitHub Secret + updater key |

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| Tauri 2.x | macOS 26 / WebKit | 首个原型必须在真实 macOS 26 上验证窗口行为 |
| Monaco 0.56.x | Vite 8 / Svelte 5 | 使用 worker 配置；避免把编辑器 worker 当普通模块打包 |
| `monaco-vim` 0.4.4 | Monaco 0.56.x | 兼容性需用快捷键冒烟验证，不能只看 npm peer 依赖 |
| `NSGlassEffectView` | macOS 26 SDK | 需要运行时 availability 检查，当前目标系统可直接使用 |

## Sources

- https://v2.tauri.app/start/prerequisites/ — macOS/Xcode/Rust 前置条件
- https://v2.tauri.app/plugin/updater/ — `latest.json`、强制更新签名和 GitHub Release
- https://v2.tauri.app/plugin/single-instance/ — 单实例插件
- https://developer.apple.com/documentation/appkit/nspanel — 原生辅助面板
- https://developer.apple.com/documentation/quicklookui/qlpreviewview — 可嵌入的 Quick Look 预览
- https://developer.apple.com/documentation/appkit/nsglasseffectview — macOS 26 Liquid Glass 公开 API
- https://developer.apple.com/documentation/appkit/nsevent/addglobalmonitorforevents(matching:handler:) — 全局事件监听与辅助功能授权
- https://microsoft.github.io/monaco-editor/typedoc/ — Monaco API

---
*Stack research for: Edgedor*
*Researched: 2026-08-26*
