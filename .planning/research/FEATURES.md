# Feature Research

**Domain:** macOS 临时代码编辑器与侧边浮层
**Researched:** 2026-08-26
**Confidence:** MEDIUM

## Feature Landscape

### Table Stakes (Users Expect These)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| 侧边呼出与焦点 | 核心产品承诺 | HIGH | 修饰键、边缘、权限、多屏必须一起验证 |
| 快速文本编辑 | 基本价值 | MEDIUM | Monaco 提供编辑状态和命令 |
| VS Code 核心编辑快捷键 | 用户明确要求 | HIGH | 只承诺编辑区域，不承诺扩展/工作台 |
| 多标签和拆分 | 临时代码常需比较内容 | HIGH | 布局状态与标签寿命耦合 |
| Hot Exit 恢复 | 退出后继续最后状态 | MEDIUM | 仅在切换/隐藏/退出时写恢复快照 |
| 查找替换、语言高亮 | 代码处理基本能力 | MEDIUM | Monaco 原生服务足够 |
| 打开/保存单个文件 | 与现有工具交换内容 | MEDIUM | `⌘S` 是唯一写回原文件的动作 |
| 菜单栏、设置、快捷键配置 | macOS 工具可控性 | MEDIUM | 设置本身独立于暂存数据 |

### Differentiators (Competitive Advantage)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| 修饰键 + 贴边才触发 | 没有普通贴边误触 | HIGH | 需要全局事件与辅助功能引导 |
| 24 小时标签寿命 | 临时但可恢复，不变成资料库 | MEDIUM | 需要启动时按真实时间清理 |
| 面板跨侧穿越动画 | 保留当前上下文的连续感 | MEDIUM | 旧侧隐藏与新侧显示必须同步 |
| 侧边标签自动远离屏幕边缘 | 适配左右呼出与窄面板 | LOW | 纯布局逻辑 |
| 四套键位方案 + 图形化覆盖 | 适配不同编辑器习惯 | HIGH | Vim 是独立模式，需单独冒烟 |
| 无痕恢复开关 | 临时敏感内容不落盘 | MEDIUM | 关闭后不能留下可恢复快照 |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| 文件夹工作区 | 便于管理大量文件 | 把工具变成 VS Code 替代品 | 只打开用户主动选择的单文件 |
| 自动保存原文件 | 省一步操作 | 破坏临时缓冲区安全边界 | 仅 `⌘S` 单次覆盖 |
| 全量语言服务器 | 智能提示更强 | 进程、配置、性能和安全面膨胀 | Monaco 基础补全 |
| 远程同步/账号 | 多设备可用 | 与本地隐私和无状态定位冲突 | 本机 Hot Exit |
| 全格式自研预览 | 看起来完整 | 维护成本和格式安全风险高 | macOS Quick Look |

## Feature Dependencies

```
单实例窗口
    └──requires──> 原生 NSPanel 与 Tauri 通信
                       └──requires──> Tauri 基础壳

Monaco 编辑器
    └──enhances──> 多标签/编辑组
                       └──requires──> 可序列化标签与布局模型

Hot Exit 与寿命
    └──requires──> 标签模型 + 文件绑定模型

Quick Look
    └──requires──> 原生 AppKit 容器 + 文件安全访问

自动更新
    └──requires──> Apple Silicon 打包 + GitHub Release
```

## MVP Definition

### Launch With (v1)

- [ ] 可安装的单实例侧边 Monaco 编辑器 — 验证核心价值
- [ ] 修饰键贴边、左右侧、多显示器和外部点击隐藏 — 验证呼出体验
- [ ] 多标签、拆分、VS Code 默认键位和 Hot Exit — 验证临时工作流
- [ ] 打开/保存文本文件与 20 MB 限制 — 验证与日常工具互操作

### Add After Validation (v1.x)

- [ ] Sublime/JetBrains/Vim 键位方案与图形化覆盖
- [ ] Quick Look、Finder 打开方式和拖放
- [ ] Liquid Glass 细节、菜单栏图标选项、登录启动
- [ ] GitHub 自动更新

### Future Consideration (v2+)

- [ ] 自定义 Monaco 主题或 VS Code 主题导入
- [ ] 语言服务器、格式化器和代码片段生态
- [ ] iCloud 或移动端

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Monaco 核心编辑 | HIGH | MEDIUM | P1 |
| 原生侧边呼出 | HIGH | HIGH | P1 |
| 多标签/拆分/恢复 | HIGH | HIGH | P1 |
| 文件打开保存 | HIGH | MEDIUM | P1 |
| Quick Look | MEDIUM | MEDIUM | P2 |
| 四套键位 | MEDIUM | HIGH | P2 |
| Liquid Glass 精修 | MEDIUM | HIGH | P2 |
| 自动更新 | MEDIUM | MEDIUM | P2 |

## Sources

- 用户逐项确认的 Edgedor 交互与范围
- Flyout 中文页面与本地下载 HTML：侧边富文本产品作为交互参考
- VS Code Hot Exit 官方文档：https://code.visualstudio.com/docs/editor/codebasics#_hot-exit
- Monaco Editor API：https://microsoft.github.io/monaco-editor/typedoc/

---
*Feature research for: Edgedor*
*Researched: 2026-08-26*
