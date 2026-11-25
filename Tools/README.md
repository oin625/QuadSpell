# D板 AI CLI

## 独立代码审查

需求卡片的「代码审查」、右键「复制代码审查」和已完成卡片均可复制短指令，交给全新的 AI 执行 `context 任务编号 --task code-review`。AI 读取原咒言、全部追加变更与 CR 专用规则，确认各仓库的实际开发分支及整段提交范围，审查完整实现和相关调用链。默认只审查，不自动修复；验证按实际疑点选择，不默认全量回归。

结论通过 `report --task code-review --review-result clear|findings|limited` 写回：一句话概括，明细写代码位置、触发条件、影响、审查范围与验证边界。能核实代码版本时必须传实际审查的 `--expect-code`，代码变化则重新审查受影响部分。CR不更新测试阶段、清单、经验库或完成状态。默认按「原咒言与全部变更→摘要与代码→有疑点才查相关历史」读取，不因摘要缺失或过时而自动读取全部历史；仍每次判断压缩是否需要。CR反馈可省略 --handoff-file，保留原摘要及未覆盖历史，只记审查概括与明细。

归档需求同样可审查；其快照用于旧版本关联，保持原内容。审查记录单独保存在本机 `dboard-archive-code-reviews.json`，已完成卡片默认显示最近概括，点击看明细；`inspect --section code` 可读取。归档CR不上传远端。

## 开发后的调试测试

每张需求可手动点「无需调试页」，随后可点「撤销无需调试页」恢复入口。选择仅存本机，`show/context` 返回 `item.debug_page_not_needed`；追加变更仍保留选择，已有页面与结果不删除。AI读取最新选择后跳过建页，后端核验、接口验证及人工联调仍按需进行；旧复制命令也会遵守最新选择。CLI不提供修改用户选择的命令。

`report --stage` 可记录 `developing`、`development-complete`、`debug-page-ready`、`testing-passed`。核验结果需要 `--summary` 和简短证据 `--details`；页面结果需要真实 `--debug-page '/模块路由'`，确认可访问后可补 `--debug-url`。先核验开发再报页面就绪，AI随后简单试调能独立验证的部分。`testing-passed` 只表示这些实际执行的部分通过，界面显示「AI试调已完成 · 待人工联调」。反馈需简短区分已测及结果、未测及原因、待用户联调事项；最终内部／外部联调测试由用户协调进行。只完成页面或构建不能写试调通过，剩余需要人工配合时直接交接。

`show/context` 返回 `item.execution` 和 `item.execution_needs_review`。原咒言、追加变更或需求资料改变后，旧结论提示重新核验；仅补充进度、分支或排期不使它失效。代码后续改变或测试失败时，AI 应回退最后可靠阶段。执行结论独立于个人状态，不自动完成或归档。

## 命令

普通命令和错误输出 JSON，`--help` 输出参数帮助。云端 runner 使用本机 MCP 命令工具和复制内容中的绝对路径。

```bash
~/.local/bin/dboard-personal-ai show D014
~/.local/bin/dboard-personal-ai report D014 \
  --expect-title 'show 返回的 title' \
  --expect-revision 'show 返回的 revision' \
  --repo '/实际 Git 工作目录' \
  --summary '开发完成，本地验证通过，待联调验收。' \
  --details '下一步：测试环境联调；尚未验收或上线。' \
  --event-id '本次反馈的稳定编号'
```

## 上线前事项完成勾选

`report --release-done L001` 将对应事项设为完成，`--release-undone L001` 取消完成；多个事项重复参数。两者直接修改 D板使用的 `done` 字段，保留原名称、明细、分类、证据和维护状态，也支持用户维护项。用户明确要求，或本轮已在授权范围内执行事项并核验成功后回写，不用把名称改成“已发布”。部署制品、发布服务和生产核验按各自事项分别判断。

先用 `context D014` 判断压缩，再用 `inspect D014 --section release` 核对完整清单，用最新 `show` 的标题和 revision 反馈：

```bash
~/.local/bin/dboard-personal-ai report D014 \
  --expect-title 'show 返回的 title' \
  --expect-revision 'show 返回的 revision' \
  --release-done L001 \
  --release-done L002 \
  --compression-decision skip \
  --compression-reason '已核对本轮状态变更，无需整体整理' \
  --event-id '本次勾选的稳定编号'
```

可与本轮 `--summary`、`--details` 和 `--handoff-file` 一起反馈；只改状态时无需另写摘要文件。取消完成须有用户指令或核实后的失效依据。相同状态和重复编号不会反向切换；同一事项同时完成／取消或删除／改状态会失败。无效编号、不存在的事项或过期 revision 拒绝整次写入。原内容修改／删除保护仍有效，CR模式和已完成需求不接受此操作，不改变需求完成状态。

`release_result.completed` 和 `reopened` 返回本次改变的编号；`skipped` 的 `already_done`／`already_undone` 表示状态已符合目标。同一 event-id 和原参数可安全重试，换动作时使用新 event-id。

## 返回结果

- 成功返回 `success: true`；report 还返回 `local_saved`、`sync`、`event_id`、`duplicate` 和最新 item。
- 写入成功但远端同步失败：退出码 3，`success: false`、`local_saved: true`，本机改动保留；用 sync 重试即可。
- 参数、目标、并发冲突或本地读写失败：退出码 2，错误信息在 `error.code` 和 `error.message`。
- `sync.status: skipped` 仅代表本地保存，没有宣称远端同步成功。

普通开发需求不提供状态修改、删除或归档命令。开发结束通过进度记录“开发完成，待验收”。

## 验证

```bash
python3 -m unittest discover -s CLITests -v
swift test --filter DboardAIFeedbackTests
```

CLI 测试使用临时缓存和 Git 仓库，不修改用户的 D单或调用真实远端同步。

## 工作树台账与完结清理

每个任务独立保留所有工作树的路径、工程、分支、创建归属和清理状态。AI 新建统一用 `worktree create D019 --repo '/原仓库' --path '/新目录' --new-branch 'feature/xxx' --start 'origin/master'`，成功即已登记；恢复已清理目录用 `--branch '实际保留的本地分支'`，临时工作树用 `--detach --start '准确提交'`。其他工具已创建的目录立即 `register --created` 补齐，复用只用 `register` 登记使用。普通 `report --repo` 自动登记使用，保留每个工程最新开发目录，不覆盖台账。复制现状返回统计、创建／读取命令和新旧任务共用的规则。

进行中的需求可查看／补登记；已完成列表展开需求后可“清理工作树”：先预览可清理项与保留原因，再确认清理。仅清理本任务创建、代码已保存并有远端跟踪引用的独立工作树；未提交／未推送、锁定、被其他未完成任务使用或有进程占用的跳过。保留主仓库、分支和提交，忽略文件随目录移除。旧目录不能凭名称猜归属，可手动补登记。

`worktree list|preview D019` 返回最新检查结果；用户明确授权 CLI 清理时用 `worktree cleanup D019 --expect-preview '<preview_revision>'`。预览后变化拒绝执行，不强制删除。台账只保存本机 `dboard-worktrees.json`，归档沿用原台账，新版本不继承所有权。详细规则：`guide --topic worktrees`。

## 技术方案与开发分支

`context D014 --task technical-plan` 返回方案任务、最新原要求与代码、按需读取入口和方案规则，不自动加载全部历史。`plan read D014` 读取正文和方案 revision；`plan save D014 --file /绝对路径/plan.json --expect-title '标题' --expect-revision '需求revision' --expect-code 'code_revision' --expect-plan '方案revision或none'` 原子保存本地方案和一句话记录，不调用模型或上传文档。JSON包含title、markdown和projects（name、branch）。用户编辑后AI须重读，不能覆盖过期版本。

`report --repo /源工作树 --repo-role development` 记录开发目录；`--repo-role integration|release` 单独保存环境工作树，不覆盖开发分支。用途不明确、名字含pre等的分支须明确分类。上线清单保留英文工程原名，例如“发布 saleinventory 服务”。

`delivery preview D014` 只读预览方案和工程；用户授权提交后用 `delivery submit D014 --expect-delivery '<preview返回的delivery_revision>'`。此命令复用原生按钮的持久化工作流，需要已构建或安装DBoard；方案或代码变化时停止。同一需求复用已有文档，校验正文后更新，本地保留旧交付快照，错误分支通过交付接口更新纠正。普通接手续写或写方案不授权自动提交。
