# QuadSpell · 四象咒言

一个独立的 macOS 需求面板：用重要程度和紧急程度整理需求，写好可以直接复制给 AI 的「咒言」。

## 功能

- 四象限与列表两种视图；拖动卡片调整象限。
- 新增、编辑、删除需求；按状态筛选，按标题、项目、备注或咒言搜索。
- 记录项目、备注、截止日期、需求状态和进度历史。
- 咒言分为「代码入口」「可能有用的资料」「要做什么」「补充说明」，一键复制成清晰的 Markdown 上下文。
- 数据只保存在本机 JSON 文件，不需要账号或服务端。

这个仓库只包含通用需求面板。它不连接需求流、钉钉、内部服务或其他个人工作台模块，也不包含原 DBoard 仓库的历史与数据。

## 运行

需要 macOS 14 或更新版本，以及 Swift 6 / Xcode Command Line Tools。

```bash
swift run QuadSpell
```

运行测试：

```bash
swift test
```

数据位置：`~/Library/Application Support/QuadSpell/demands.json`。备份或迁移时复制该文件即可。首次运行从空面板开始；不会读取现有 DBoard 的数据。当前版本没有自动同步，删除需求前请自行备份数据文件。

## 项目结构

- `Sources/Models.swift`：需求、四象限、状态与咒言的通用模型。
- `Sources/DemandStore.swift`：本机 JSON 持久化。
- `Sources/DemandBoardView.swift`：需求面板、搜索、列表与四象限拖动。
- `Sources/DemandEditorView.swift`：需求和咒言编辑。

## 参与

欢迎提交 Issue 和 Pull Request。请不要在问题描述、截图或测试数据中上传真实的需求、内部链接、密钥或客户资料。

## 许可证

MIT，见 [LICENSE](LICENSE)。
