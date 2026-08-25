# Edgedor

Edgedor 是面向 macOS 26 Tahoe 和 Apple Silicon 的临时代码工作台。按住配置好的修饰键，把鼠标移到任意显示器的左、右边缘即可呼出侧边面板；松开修饰键或点击面板外部即可隐藏。编辑区使用 Monaco，提供接近 VS Code 编辑区域的多光标、列选择、查找替换和快捷键行为。

## 下载与安装

- [下载最新 Release](https://github.com/Mrered/Edgedor/releases)：发布版本由 tag 工作流自动生成并正式发布。
- [查看主分支构建](https://github.com/Mrered/Edgedor/actions/workflows/ci.yml)：打开最新成功的 `Edgedor CI` 运行，在页面底部下载 `edgedor-arm64` artifact。该构建保留 14 天。
- 下载 `.dmg` 后打开并将 `Edgedor.app` 拖入“应用程序”文件夹。当前包尚未配置 Apple Developer 签名和公证；如果 macOS 首次阻止打开，请在 Finder 中右键应用选择“打开”，确认来源可信后再运行，不要关闭系统 Gatekeeper。

Edgedor 只支持 macOS 26 Tahoe 或更高版本以及 arm64 Apple Silicon（M 系列）Mac，不支持 Intel Mac 或旧版 macOS。应用包已声明最低系统版本 `26.0`。

## 首次运行权限

贴边呼出依赖 macOS 全局事件监听。首次使用前，在“系统设置 → 隐私与安全性”中为 Edgedor 授予：

1. “辅助功能”；
2. “输入监控”。

授权后重新启动 Edgedor。未授权时应用仍可打开和编辑，但不会稳定响应“修饰键 + 贴边”触发。Edgedor 不会代替用户修改这些系统权限。

## 当前能力

- 严格单实例、单侧边窗口、多显示器左右边缘触发和可固定面板。
- 多个临时标签，自动标题，24 小时未访问后过期，并提供最多 10 个关闭/过期撤销槽。
- 可选重启恢复最后状态；关闭该选项后，临时标签内容不写入磁盘。开启时恢复数据保存在本机浏览器存储中，不加密，行为类似 VS Code Hot Exit。
- 文本标签可通过一次 `⌘S` 保存到当前文件路径；未触发保存不会覆盖原始文件。
- 支持文本文件打开、拖放、常见 UTF-8/UTF-16/GB18030 编码和 `\n`、`\r\n`、`\r` 换行；图片和 PDF 可用预览标签打开。
- VS Code、Sublime Text、JetBrains、Vim 快捷键方案，以及“逐个选择相同内容”的图形化快捷键覆盖设置。
- 面板宽度按当前屏幕比例计算，目标范围为 20%～60%，编辑组与标签布局会随会话状态恢复。

## 已知限制

- 单个文本文件超过 20 MB 时只提示，不创建编辑标签。
- 非文本预览依赖当前 macOS WebKit 能打开的图片/PDF 数据；不支持的文件会提示后不执行操作，完整 Quick Look/Office 预览仍在后续里程碑中。
- 全局贴边触发需要用户手动授予权限；全屏空间、外接显示器和权限状态变化应在真实机器上单独验收。
- 这是临时工作台，不是长期笔记库。标签会过期，恢复数据也可能因用户关闭恢复开关、清理浏览器数据或系统策略而消失。

## 开发

```bash
npm install
npm run check:session
npm run check
npm run build
npm run tauri dev
```

## 发布与自动更新状态

推送 `v*` tag 会触发 `.github/workflows/release.yml`，在 macOS runner 上构建 arm64 `.app` 和 `.dmg`，并自动发布 Release。检查通过的 `main` push 会触发 `.github/workflows/ci.yml`，将同样的安装包作为可下载 artifact 保存 14 天。

Tauri Updater 当前**未启用**：仓库没有 updater 公钥、私钥或 `latest.json`，也不会在 CI 中生成密钥。现阶段请从 GitHub Release 手动下载；后续要启用自动更新时，需要单独生成并安全保存 Tauri updater 私钥、配置 GitHub Actions Secret 和签名公钥后再实施。

## 许可证

MIT
