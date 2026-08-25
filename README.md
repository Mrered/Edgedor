# Edgedor

Edgedor 是面向 macOS 26 Apple Silicon 的临时代码工作台：按住修饰键贴近屏幕左右边缘即可呼出，使用 Monaco 提供接近 VS Code 编辑区域的快捷键行为。

## 当前能力

- Tauri 2、Svelte 5、TypeScript、Monaco Editor
- 真实 macOS `NSPanel`、单实例、多显示器左右边缘触发
- 多临时标签、自动标题、24 小时过期、关闭撤销槽和重启恢复
- 临时标签主动保存为文本文件，支持拖放和路径打开
- VS Code、Sublime Text、JetBrains、Vim 快捷键方案设置
- arm64 DMG 和 GitHub Actions 构建/发布流程

## 开发

```bash
npm install
npm run check:session
npm run check
npm run build
npm run tauri dev
```

贴边全局监听需要在 macOS“隐私与安全性”中授予 Edgedor 辅助功能和输入监控权限。项目只支持 macOS 26 Apple Silicon，当前仍处于快速迭代阶段。

## 发布

推送 `v*` 标签会触发 `.github/workflows/release.yml`，生成 arm64 `.app`/DMG 草稿 Release。更新签名和自动更新元数据需要在仓库 Secrets 中配置 Tauri updater 私钥后启用。

## 许可证

MIT
