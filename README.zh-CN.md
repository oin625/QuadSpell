# QuadSpell · 四象咒言

**换 AI，换会话，任务接着做。**

一键复制任务上下文与已记录进度，粘贴到你想用的 AI 会话框里。

[下载 Windows 版](https://github.com/oin625/QuadSpell/releases/latest) · [macOS 快速开始](#开始使用) · [English](README.md)

[![Windows build](https://github.com/oin625/QuadSpell/actions/workflows/windows.yml/badge.svg?branch=main)](https://github.com/oin625/QuadSpell/actions/workflows/windows.yml)
[![macOS tests](https://github.com/oin625/QuadSpell/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/oin625/QuadSpell/actions/workflows/ci.yml)
[![MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

![使用流程示意：选择任务，一键复制已保存的上下文，粘贴到下一个 AI 会话。](docs/assets/session-handoff.svg)

会话太长了，想开个新的；这次想换一家 AI；手上几项任务来回切，明天又要接着做。

QuadSpell 把目标、背景、资料线索、约束和进度放在任务里，组成一份可以反复使用的**「咒言」**。需要继续时，一键复制，直接粘贴到 ChatGPT、Claude、Gemini、编码助手，或任何支持文本输入的 AI 会话。

**任务上下文留在你手里，下一轮用哪家 AI，由你决定。**

## 选任务 → 一键复制 → 粘贴 → 接着做

1. **把任务交代清楚。** 写下要做什么、相关代码入口、可能有用的资料和补充约束。
2. **一键带走上下文。** 点击卡片上的 **✦ 咒言按钮**，或编辑器里的 **「保存并复制咒言」**，已保存的内容和进度会组装为 Markdown。
3. **随时换会话。** 粘贴到想用的 AI 里：换一家、开新会话，或切回另一项任务，都有现成的上下文。
4. **下一次切换前补一条进度。** 记下已完成什么、还剩什么，下次复制就会带上这次更新。

复制在本机完成，**无需配置 API Key、插件或 AI 供应商**。打开想用的会话框，粘贴即可。

| 你想做的事 | 一键带过去的内容 |
| --- | --- |
| 同一家 AI 开个新会话 | 任务目标、资料线索和已保存进度 |
| 换一家 AI 继续 | 同一份咒言，直接粘贴到它的文本输入框 |
| 从另一项任务切回来 | 这项任务自己的上下文和已记录的后续事项 |

进度由你在 QuadSpell 中记录。复制内容中的文件路径和链接是资料线索；所选聊天工具需要文件正文时，请一并附上相应文件。

## 复制出去的内容长什么样

咒言会带上任务标题与项目、背景备注、代码入口、资料线索、目标、约束和进度记录，未填的可选部分会省略。

<details>
<summary>看一个真实复制示例：新会话直接看到已完成什么、哪些验证还没做</summary>

以下内容由当前版本的复制函数生成：

```markdown
# 需求：修复搜索结果排序

项目：示例应用

背景与备注：
保留现有搜索过滤行为。

## 代码入口
src/search.ts
请先定位并阅读相关实现。

## 可能有用的资料
docs/search-behavior.md
请按需查找并阅读。

## 要做什么
让搜索结果按时间排序，保留现有过滤逻辑，并验证空结果与相同时间的排序。

## 补充说明
本次只修改排序，接续完成剩余验证。

## 已记录的进度
- 2026/11/5 08:00:00：排序已实现，空结果已验证；相同时间的排序与回归检查还未完成。
```

换一个会话，任务目标、修改范围和剩余验证仍然交代得清楚。

</details>

## 四象限帮你选下一件事

先按重要程度和紧急程度挑选任务，再把它的上下文一键带进会话。

- 拖动卡片调整象限，支持列表 / 四象限两种视图。
- 按标题、项目、备注或咒言搜索任务。
- 记录状态、截止日期和进度历史。

## 接续任务，保留本轮变化

- **草稿自动保存在本机。** 新建或编辑需求时，未完成的输入、进度和变更会保存为草稿。关闭或重启后，从顶部“草稿”入口恢复；保存后正式生效，选择“放弃草稿”只清除未保存内容。
- **原目标保留，变更单独追加。** 在“这次要改什么”中填写本轮调整，保存时追加为 C001、C002 等记录。复制咒言会带上原目标和全部变更，并提醒接手者保留未完成的验证。
- **用交接摘要说明当前现状。** 手动填写已完成、下一步、关键决定和验证结果。填写“下一步”和“验证结果”后，更新摘要会涵盖截至本次保存的进度；之后新增的进度继续随咒言复制。摘要未填完整时仍复制全部进度，完整历史始终保留在编辑器里，清空摘要可恢复复制全部历史。
- **保存前核对数据是否变化。** 发现需求或本地文件在编辑期间被其他窗口、应用或手动修改时，会阻止覆盖并保留草稿。先复制需要的内容，再放弃旧草稿、重新打开需求核对。

摘要由你维护，QuadSpell 不调用 AI 自动总结，也不把未验证事项标记为通过。

## 开始使用

**Windows x64：** [下载最新版本](https://github.com/oin625/QuadSpell/releases/latest)，选择安装版 `QuadSpell-Setup-*.exe` 或免安装版 `QuadSpell-Portable-*.exe`。当前安装包未签名，首次运行可能提示「未知发布者」。

**macOS 14+：** 安装 Swift 6 / Xcode Command Line Tools 后，从源码运行原生版：

```bash
git clone https://github.com/oin625/QuadSpell.git
cd QuadSpell
swift run QuadSpell
```

当前桌面界面为简体中文，任务内容可使用任意语言填写。

## 任务上下文保存在本机

数据保存为本机 JSON 文件：

| 平台 | 数据位置 |
| --- | --- |
| Windows | `%APPDATA%\QuadSpell\demands.json` |
| macOS | `~/Library/Application Support/QuadSpell/demands.json` |

两端使用同一种数据格式。迁移时关闭应用，再把文件复制到另一台电脑的对应位置。首次运行从空面板开始，同步由你手动完成。

0.3.0 使用第 2 版数据格式，并可读取旧的第 1 版文件；首次保存时升级，保留已有需求和进度。旧版应用会拒绝写入第 2 版文件，避免丢失摘要和变更；迁移前请更新两端应用。草稿单独保存在同目录的 `drafts.json`，迁移需求不需要复制草稿。

## 开发与参与

`Sources/` 是 macOS 原生 SwiftUI 版，`desktop/` 是 Electron 桌面版。

```bash
# macOS 原生版测试
swift test

# Electron 桌面版，需要 Node.js 22
npm install --no-package-lock
npm start
npm run test:desktop
npm run smoke:desktop

# 在 Windows 上打包
npm run dist:win
```

你是怎样在不同 AI 会话之间接续任务的？欢迎[分享使用场景](https://github.com/oin625/QuadSpell/issues)，一起改进上下文接续、交互和语言支持。

[MIT 许可证](LICENSE)。
