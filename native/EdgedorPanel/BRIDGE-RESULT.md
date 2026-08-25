# Native Panel Bridge

状态：未接入 Tauri macOS runner。

Phase 1 当前可验证的是 Tauri WebView 窗口、Rust typed panel action/status 与单实例插件；`PanelOwner.swift` 已保留唯一 `NSPanel` owner 的 AppKit 边界，但尚未承载真实 WebView，也没有将 Rust action 接到 Swift。

因此本阶段不宣称真实 `NSPanel` round-trip 完成，下一步必须在 macOS runner 中完成 Swift/AppKit bridge 后再验收。
