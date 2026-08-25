# Phase 1 冒烟记录

## 已通过

- `rustc -Vv`：Rust stable 1.98.0，host `aarch64-apple-darwin`。
- `rustup target list --installed`：包含 `aarch64-apple-darwin`。
- `npm run check`：Svelte diagnostics 0 errors / 0 warnings。
- `npm run build`：SvelteKit/Vite production build 成功。
- `cargo check --manifest-path src-tauri/Cargo.toml`：成功。
- `npm run tauri build -- --target aarch64-apple-darwin --bundles app,dmg`：构建成功，DMG 为 `src-tauri/target/aarch64-apple-darwin/release/bundle/dmg/Edgedor_0.1.0_aarch64.dmg`。
- `cargo check` 同时覆盖 `objc2` 的真实 `NSPanel` owner 与 `NSEvent` 贴边监视器；运行时仍需 macOS 辅助功能权限冒烟。

## 尚未完成

- `npm run tauri dev` / arm64 DMG 的人工安装启动记录。
- Swift `NSPanel` 承载 Tauri WebView 的 show/focus/hide/status round-trip（当前改用 Rust/objc2 owner，待实机验证）。
- 实机重复启动、浅深色和中英文切换冒烟。

## 结论

Walking Skeleton 可编译，Monaco 单模型编辑区和 Rust 单实例/typed 状态边界已建立；原生面板桥接仍是下一检查点，不把普通窗口当作完成。
