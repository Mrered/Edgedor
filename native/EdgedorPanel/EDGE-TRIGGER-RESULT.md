# Edge Trigger Slice

本切片实现 macOS `NSEvent` 全局鼠标/修饰键监视器，默认 `Command + 150ms`，并按所有 `NSScreen` 的左右边缘进行基础判定。`EdgeTrigger::start` 只发出 `Edge::{Left,Right}` 事件，不直接操作面板；主程序接线时应在回调中调用现有 native panel action。

## 边界

- 需要用户为 Edgedor 授予辅助功能/输入监控权限；未授权时 `start` 返回可见错误。
- 当前事件驱动实现以持续 `mouseMoved` 为计时采样点，后续可换成主线程 timer 以覆盖完全静止的指针场景。
- 本切片未修改 Svelte，也未假装完成真实运行时接线。

## 验证

运行 `cargo check --manifest-path src-tauri/Cargo.toml`（macOS arm64）验证 `objc2-app-kit` 的 `NSEvent`/`NSScreen`/`block2` API 与 Rust 类型边界。
