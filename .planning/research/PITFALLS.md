# Pitfalls Research

**Domain:** macOS 原生侧边浮层 + Web 编辑器
**Researched:** 2026-08-26
**Confidence:** MEDIUM

## Critical Pitfalls

### Pitfall 1: 把 NSPanel 可行性留到最后

**What goes wrong:** 普通 Tauri 窗口无法稳定实现全屏覆盖、层级、空间跟随和跨侧动画。
**Why it happens:** Web UI 先做起来很快，原生窗口约束被低估。
**How to avoid:** Phase 1 先做 Apple Silicon 原生 panel spike：显示、聚焦、隐藏、切侧和 WebView 嵌入。
**Warning signs:** 需要 hack `alwaysOnTop`、窗口切换会离开台前调度。
**Phase to address:** Phase 1/2

### Pitfall 2: 全局事件权限与触发逻辑混淆

**What goes wrong:** 未授权时修饰键或鼠标事件只在本应用内有效，用户以为功能随机失灵。
**Why it happens:** `NSEvent.addGlobalMonitor` 只能观察其他应用事件，Apple 要求辅助功能信任。
**How to avoid:** 首次运行做权限说明、状态检查和降级提示；不要静默失败。
**Warning signs:** Finder/浏览器前台时无法呼出，应用前台却正常。
**Phase to address:** Phase 2

### Pitfall 3: 把“VS Code 全部快捷键”承诺成完整 VS Code

**What goes wrong:** Monaco 能覆盖编辑器命令，但工作台、扩展、语言服务器和插件命令不存在。
**Why it happens:** 产品文案把编辑区和 VS Code 整体混为一谈。
**How to avoid:** 验收矩阵限定 Monaco 编辑区域命令；明确列出不支持的工作台命令。
**Warning signs:** 要求 `workbench.action.*`、扩展命令或语言服务后端。
**Phase to address:** Phase 3

### Pitfall 4: 恢复快照与原文件保存混在一起

**What goes wrong:** 自动恢复把未保存内容写回原文件，违反临时缓冲区安全边界。
**Why it happens:** 复用普通文件保存函数而没有区分 session snapshot。
**How to avoid:** 恢复快照只能写应用私有目录；只有显式 `⌘S` 进入文件 overwrite command。
**Warning signs:** 切换标签、退出或过期后磁盘 mtime 改变。
**Phase to address:** Phase 4/5

### Pitfall 5: 面板、WebView 和 Quick Look 三套坐标系漂移

**What goes wrong:** 玻璃工具栏、编辑区、预览视图或拖放区域出现错位和点击穿透。
**Why it happens:** 屏幕坐标、窗口坐标、WebView CSS 像素和 Retina backing scale 混用。
**How to avoid:** 统一使用 logical frame 与 backing scale 转换，并在多屏/缩放/全屏实机冒烟。
**Warning signs:** 只在 Retina、第二显示器或 Dock 在侧边时复现。
**Phase to address:** Phase 2/5

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| 先用普通窗口假装 NSPanel | 很快看到 UI | 后续窗口模型重写 | 仅 Phase 1 spike，不能合入功能完成 |
| 先用 UTF-8 覆盖所有文件 | 实现简单 | 破坏 GB18030/UTF-16 文件 | 仅临时原型且明确提示 |
| 把 Monaco view state 当文档数据 | 少写模型 | 关闭/跨组/恢复不可靠 | 不接受 |
| 先忽略权限失败 | Demo 顺畅 | 跨应用核心功能不可用 | 仅单元局部开发 |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Tauri Updater | 只上传 DMG、不生成签名和 `latest.json` | 用 updater key、Actions Secret 和公开 Release |
| Finder Open With | 每次创建新窗口 | single-instance 插件将参数发给现有实例 |
| Quick Look | 在 WebView 中直接猜路径加载 | 原生 `QLPreviewView` 管理 preview item |
| AppKit global monitor | 把 global monitor 当事件拦截器 | 只观察并用权限状态做明确降级 |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| 每个标签重复创建 Monaco model | 内存持续增长 | 按 tab registry 复用并及时 dispose | 数十个标签 |
| 大文件通过前端 JSON 往返 | 粘贴/打开卡死 | Rust 读取并限制 20 MB | 接近上限文件 |
| 快速鼠标移动每次都做窗口动画 | 抖动与高 CPU | dwell debounce、显示器锁定、可取消动画 | 多屏边缘来回移动 |
| 每个字符都写恢复快照 | 输入卡顿、SSD 写放大 | 只在确认的边界保存 | 长时间编辑 |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| 把路径和文件内容直接拼进 shell | 命令注入/误覆盖 | 使用 Rust 文件 API，不调用 shell |
| 更新私钥提交仓库 | 任意伪造更新 | 只放 GitHub Actions Secret，轮换公钥 |
| 无痕开关关闭后仍保留旧快照 | 隐私承诺失真 | 关闭时删除已有 session 文件并禁止写入 |
| 对未知文件调用默认应用 | 执行不受信任文件 | 按确认范围提示不支持，不自动打开 |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| 未授权时“贴边无反应” | 误判软件坏了 | 首次解释，设置页显示权限状态 |
| 面板跨屏跟随鼠标跳动 | 打断输入 | 触发后锁定显示器 |
| 标签到期弹大量通知 | 临时工具变得吵闹 | 静默进入撤销槽 |
| `Esc` 隐藏面板 | 破坏 VS Code 编辑行为 | Esc 完全交给 Monaco |

## "Looks Done But Isn't" Checklist

- [ ] **边缘呼出：** 已在外部应用、全屏、台前调度、Dock 侧边和第二显示器验证权限与层级。
- [ ] **快捷键：** 已验证列选择、多光标、移动/删除行、逐个选中相同内容、Esc 与查找框。
- [ ] **恢复：** 已验证正常退出、崩溃近似场景、关闭恢复开关和过期标签。
- [ ] **保存：** 切换/隐藏/退出不会改变绑定原文件 mtime；只有 `⌘S` 覆盖。
- [ ] **更新：** Release 同时有 DMG、签名更新包和 `latest.json`，失败时不会破坏现有版本。

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| NSPanel 可行性 | Phase 1/2 | 实机面板与 WebView 冒烟 |
| 全局权限 | Phase 2 | 外部应用前台触发测试 |
| VS Code 边界 | Phase 3 | 快捷键验收矩阵 |
| 恢复/保存分离 | Phase 4/5 | mtime 与快照检查 |
| 坐标系漂移 | Phase 2/5 | Retina、多屏、缩放手测 |
| 更新签名 | Phase 6 | GitHub Release 安装升级 |

## Sources

- https://developer.apple.com/documentation/appkit/nspanel
- https://developer.apple.com/documentation/appkit/nsevent/addglobalmonitorforevents(matching:handler:)
- https://developer.apple.com/documentation/appkit/nsglasseffectview
- https://developer.apple.com/documentation/quicklookui/qlpreviewview
- https://v2.tauri.app/plugin/updater/
- https://code.visualstudio.com/docs/editor/codebasics#_hot-exit

---
*Pitfalls research for: Edgedor*
*Researched: 2026-08-26*
