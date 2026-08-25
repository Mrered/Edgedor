---
status: complete
---

# 最终验收缺口修复

## 已完成

- 临时标签才会进入 24 小时过期流程，文件标签保持普通标签行为。
- 撤销恢复会刷新标签访问时间，避免恢复后立即再次过期。
- 关闭恢复选项会清理旧的本地状态；预览标签只持久化路径，重启时重新生成预览数据。
- Monaco 监听光标选择变化，保留多光标/矩阵选择视图状态；自定义快捷键解析覆盖常用功能键、数字、标点和方向键。
- Vim 方案接入 `monaco-vim` 编辑区模式。
- 原始 Tauri 宿主窗口默认隐藏，WKWebView 设置为随 NSPanel 尺寸变化自动填充。

## 验证

- `npm run check`
- `npm run check:session`
- `npm run build`
- `cargo check --manifest-path src-tauri/Cargo.toml`
- GitHub CI `32904051866` 成功。
- GitHub Release `32904324672` 成功，`v0.1.7` 正式发布并包含 arm64 DMG/App 资产。
