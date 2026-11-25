import Foundation

/// Task identity and feedback entry points are generated only at copy time, never persisted as user input.
enum DboardAITaskContext {
    static func readInstruction(item: DItem, changeID: String? = nil, cacheURL: URL? = nil, archiveRevision: String? = nil,
                                home: String = FileManager.default.homeDirectoryForCurrentUser.path) -> String {
        var command = quote(home + "/.local/bin/dboard-personal-ai")
        if let cacheURL { command += " --cache " + quote(cacheURL.path) }
        if let archiveRevision { command += " --archive-revision " + quote(archiveRevision) }
        command += " context " + quote(item.id)
        if archiveRevision != nil {
            return "请查看 D板已归档任务 \(item.id)「\(item.displayTitle)」的完整记录，通过本机命令工具执行：\n" + command +
                "\n按需读取原咒言、追加变更、进度和验证记录。归档内容仅供查阅。"
        }
        if let changeID { command += " --change " + quote(changeID) }
        let instruction = (item.isIncident ? "请接手 D板排查 " : "请接手 D板任务 ") + item.id + "「" + item.displayTitle + "」，通过本机命令工具执行：\n" +
            command + "\n请阅读原咒言、最新进度和追加变更，冲突以后续变更为准；仅继续未完成事项，无事可做则直接反馈，不重复开发或自行扩展。每次检查返回的压缩判断并遵循反馈规则；每轮结束前，有新进展时更新摘要和修改记录，先一句话概括，再按需写明细。"
        return instruction
    }

    static func reviewInstruction(item: DItem, cacheURL: URL? = nil, archiveRevision: String? = nil,
                                  home: String = FileManager.default.homeDirectoryForCurrentUser.path) -> String {
        var command = quote(home + "/.local/bin/dboard-personal-ai")
        if let cacheURL { command += " --cache " + quote(cacheURL.path) }
        if let archiveRevision { command += " --archive-revision " + quote(archiveRevision) }
        command += " context " + quote(item.id) + " --task code-review"
        return "请独立审查 D板任务 " + item.id + "「" + item.displayTitle + "」的整体代码，通过本机命令工具执行：\n" +
            command + "\n按返回的 CR 规则，结合原咒言、全部追加变更和实际开发分支，审查完整实现及相关调用链。先审查，不改代码；问题给出位置、触发条件和影响，结论先一句话概括，再按需明细记回 D板。"
    }

    static func planInstruction(item: DItem, cacheURL: URL? = nil,
                                home: String = FileManager.default.homeDirectoryForCurrentUser.path) -> String {
        var command = quote(home + "/.local/bin/dboard-personal-ai")
        if let cacheURL { command += " --cache " + quote(cacheURL.path) }
        command += " context " + quote(item.id) + " --task technical-plan"
        return "请准备／更新 D板任务 " + item.id + "「" + item.displayTitle + "」的技术方案，通过本机命令工具执行：\n" +
            command + "\n结合原咒言、全部追加变更、用户纠正和实际代码，按返回规则维护清晰完整的技术方案；核实源开发分支，预发／发布分支另记。用 plan save 保存到 D板，暂不上传或提交交付物。"
    }

    private static func quote(_ value: String) -> String {
        "'" + value.replacingOccurrences(of: "'", with: "'\\''") + "'"
    }
}

extension DItemStore {
    enum SnapshotError: LocalizedError {
        case unavailable, missing, ambiguous, unreadableChanges, unreadableVersion
        case unreadableExecution, unreadableDebugPagePolicy
        var errorDescription: String? {
            switch self {
            case .unavailable: return "无法读取任务数据，请重试"
            case .missing: return "这张任务已不存在，请刷新首页"
            case .ambiguous: return "任务编号重复，请先检查数据"
            case .unreadableChanges: return "变更记录无法读取，请检查数据后重试"
            case .unreadableVersion: return "上一版本的背景无法读取，请检查数据后重试"
            case .unreadableExecution: return "调试进度无法读取，请检查数据后重试"
            case .unreadableDebugPagePolicy: return "调试页设置无法读取，请检查数据后重试"
            }
        }
    }

    /// Read under the same lock as GUI/CLI writers, without falling back to a stale card.
    static func currentItem(id: String, at url: URL? = nil, archiveRevision: String? = nil) throws -> DItem {
        DemandCodeReviews.checked(try currentRecord(id: id, at: url, archiveRevision: archiveRevision))
    }

    /// Editors need fresh, validated data without running Git checks on the UI thread.
    static func currentRecord(id: String, at url: URL? = nil, archiveRevision: String? = nil) throws -> DItem {
        guard let result = CacheFile.withLock(at: url, {
            Result<DItem, Error> {
                let cacheURL = url ?? URL(fileURLWithPath: CacheFile.path)
                let items: [DItem]
                if cacheURL.lastPathComponent == "dboard-archive-cache.md" {
                    let journal = ArchiveJournal(url: cacheURL.deletingLastPathComponent().appendingPathComponent(ArchiveJournal.filename))
                    let remote = (try? DemandArchive.parse(String(contentsOf: cacheURL, encoding: .utf8))) ?? []
                    items = DemandArchive.merged(remote, journal: journal)
                        .filter { archiveRevision == nil || $0.id == archiveRevision }.map(\.item)
                } else {
                    let content = try String(contentsOf: cacheURL, encoding: .utf8)
                    items = CacheParser.parse(content: content).items
                }
                let matches = items.filter { $0.id == id }
                guard let item = matches.first else { throw SnapshotError.missing }
                guard matches.count == 1 else { throw SnapshotError.ambiguous }
                guard item.changeReadError == nil else { throw SnapshotError.unreadableChanges }
                guard item.versionReadError == nil else { throw SnapshotError.unreadableVersion }
                guard item.executionReadError == nil else { throw SnapshotError.unreadableExecution }
                guard item.debugPageReadError == nil else { throw SnapshotError.unreadableDebugPagePolicy }
                return item
            }
        }) else { throw SnapshotError.unavailable }
        return try result.get()
    }
}
