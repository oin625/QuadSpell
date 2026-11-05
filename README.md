# QuadSpell · 四象咒言

一个独立的 macOS / Windows 需求面板：用重要程度和紧急程度整理需求，写好可以直接复制给 AI 的「咒言」。

## 功能

- 四象限与列表两种视图；拖动卡片调整象限。
- 新增、编辑、删除需求；按状态筛选，按标题、项目、备注或咒言搜索。
- 记录项目、备注、截止日期、需求状态和进度历史。
- 咒言分为「代码入口」「可能有用的资料」「要做什么」「补充说明」，一键复制成 Markdown 上下文。
- 数据只保存在本机 JSON 文件，不需要账号或服务端。

这个仓库只包含通用需求面板。它不连接需求流、钉钉、内部服务或其他个人工作台模块，也不包含原 DBoard 仓库的历史与数据。

## Windows

从 [Releases](https://github.com/oin625/QuadSpell/releases) 下载 Windows 64 位安装程序（`Setup.exe`）或免安装版（`portable.exe`）。安装后打开 QuadSpell 即可使用。

开发运行需要 Node.js 22：

```bash
npm install --no-package-lock
npm start
```

在 Windows 上构建安装程序和免安装版：

```bash
npm run test:desktop
npm run dist:win
```

数据位置：`%APPDATA%\QuadSpell\demands.json`。

## macOS

需要 macOS 14 或更新版本，以及 Swift 6 / Xcode Command Line Tools。原生版运行命令：

```bash
swift run QuadSpell
```

测试：

```bash
swift test
```

数据位置：`~/Library/Application Support/QuadSpell/demands.json`。

macOS 原生版和 Windows 版采用相同的 JSON 数据格式。迁移时关闭应用，再将 `demands.json` 复制到另一台电脑的对应位置。首次运行从空面板开始；不会读取现有 DBoard 的数据。当前版本没有自动同步。

## 项目结构

- `Sources/`：macOS 原生 SwiftUI 版。
- `desktop/`：Windows 桌面版，包含本地数据模型、Electron 主进程与界面。
- `Tests/` 和 `desktop/tests/`：数据格式与核心行为测试。

## 参与

欢迎提交 Issue 和 Pull Request。请不要在问题描述、截图或测试数据中上传真实的需求、内部链接、密钥或客户资料。

## 许可证

MIT，见 [LICENSE](LICENSE)。
