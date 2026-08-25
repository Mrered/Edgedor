# Native Panel Bridge

状态：已接入 Rust/objc2 macOS runner，等待目标机人工冒烟。

实现边界：`src-tauri/src/native_panel.rs` 在 Tauri `setup` 主线程创建并永久保留唯一 `NSPanel`，通过 AppKit `NSView` API 将 Tauri 暴露的 `WKWebView` 从初始窗口移入面板内容视图；Rust `panel_action(show|focus|hide)` 直接操作该面板。Swift `PanelOwner.swift` 继续作为后续 Swift/AppKit 扩展的边界样例，当前不与 Rust owner 并存。

已验证（2026-08-26，macOS arm64 编译）：

- `cargo check --manifest-path src-tauri/Cargo.toml`：通过。
- `objc2-app-kit` 的 `NSPanel` 初始化、`NSWindow` show/focus/hide API：通过类型检查。
- Tauri setup 与 `with_webview` 的主线程回调闭包：通过类型检查。

尚未验证：运行时 WebView 迁移后的焦点/重绘、跨应用浮层和打包产物。需要在 macOS 26 Apple Silicon 上执行 `cargo tauri dev`，确认单实例、面板显示/隐藏及 Monaco 输入；若运行时崩溃，应保留日志并回退为直接集成 Wry `WebViewExtMacOS::reparent` 的实现，而不是 CSS 假窗口。
