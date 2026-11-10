import Foundation

enum Quadrant: String, Codable, CaseIterable, Identifiable {
    case importantUrgent
    case importantNotUrgent
    case notImportantUrgent
    case notImportantNotUrgent

    var id: String { rawValue }

    var title: String {
        switch self {
        case .importantUrgent: "重要且紧急"
        case .importantNotUrgent: "重要不紧急"
        case .notImportantUrgent: "紧急不重要"
        case .notImportantNotUrgent: "不紧急不重要"
        }
    }

    static let rows: [[Quadrant]] = [
        [.importantNotUrgent, .importantUrgent],
        [.notImportantNotUrgent, .notImportantUrgent]
    ]
}

enum DemandStatus: String, Codable, CaseIterable, Identifiable {
    case planned
    case inProgress
    case paused
    case completed

    var id: String { rawValue }

    var title: String {
        switch self {
        case .planned: "待开始"
        case .inProgress: "进行中"
        case .paused: "挂起"
        case .completed: "已完成"
        }
    }
}

struct Spell: Codable, Equatable {
    var codeEntry = ""
    var materials = ""
    var intent = ""
    var supplement = ""

    var isEmpty: Bool {
        [codeEntry, materials, intent, supplement].allSatisfy {
            $0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        }
    }

    var isValid: Bool {
        isEmpty || !intent.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    func prompt(for demand: Demand) -> String {
        var sections = ["# 需求：\(demand.title)"]
        if !demand.project.isEmpty { sections.append("项目：\(demand.project)") }
        if !demand.notes.isEmpty { sections.append("背景与备注：\n\(demand.notes)") }
        if !codeEntry.isEmpty {
            sections.append("## 代码入口\n\(codeEntry)\n请先定位并阅读相关实现。")
        }
        if !materials.isEmpty {
            sections.append("## 可能有用的资料\n\(materials)\n请按需查找并阅读。")
        }
        if !intent.isEmpty { sections.append("## 要做什么\n\(intent)") }
        if !supplement.isEmpty { sections.append("## 补充说明\n\(supplement)") }
        if !demand.changes.isEmpty {
            sections.append("## 追加变更\n以下是在原目标上的调整，请保留尚未完成的验证：\n" +
                demand.changes.enumerated().map { index, change in
                    "### C\(String(format: "%03d", index + 1))\n\(change.text)"
                }.joined(separator: "\n\n"))
        }
        if !demand.handoff.isEmpty {
            sections.append(demand.handoff.prompt)
        }
        let progress = demand.handoff.isEmpty ? demand.progress :
            Array(demand.progress.dropFirst(demand.handoff.coveredProgressCount))
        if !progress.isEmpty {
            let history = progress.map { entry in
                "- \(entry.createdAt.formatted(date: .numeric, time: .shortened))：\(entry.text)"
            }.joined(separator: "\n")
            sections.append((demand.handoff.isEmpty ? "## 已记录的进度\n" : "## 摘要之后的新进度\n") + history)
        }
        return sections.joined(separator: "\n\n")
    }
}

struct ProgressEntry: Codable, Identifiable, Equatable {
    var id = UUID()
    var createdAt = Date()
    var text: String
}

struct Demand: Codable, Identifiable, Equatable {
    var id = UUID()
    var title = ""
    var project = ""
    var notes = ""
    var quadrant: Quadrant = .importantNotUrgent
    var status: DemandStatus = .planned
    var dueDate: Date?
    var spell = Spell()
    var progress: [ProgressEntry] = []
    var createdAt = Date()
    var updatedAt = Date()
    var handoff = Handoff()
    var changes: [ChangeEntry] = []

    private enum CodingKeys: String, CodingKey {
        case id, title, project, notes, quadrant, status, dueDate, spell, progress
        case createdAt, updatedAt, handoff, changes
    }

    init() {}

    init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        id = try values.decode(UUID.self, forKey: .id)
        title = try values.decode(String.self, forKey: .title)
        project = try values.decode(String.self, forKey: .project)
        notes = try values.decode(String.self, forKey: .notes)
        quadrant = try values.decode(Quadrant.self, forKey: .quadrant)
        status = try values.decode(DemandStatus.self, forKey: .status)
        dueDate = try values.decodeIfPresent(Date.self, forKey: .dueDate)
        spell = try values.decode(Spell.self, forKey: .spell)
        progress = try values.decode([ProgressEntry].self, forKey: .progress)
        createdAt = try values.decode(Date.self, forKey: .createdAt)
        updatedAt = try values.decode(Date.self, forKey: .updatedAt)
        handoff = try values.decodeIfPresent(Handoff.self, forKey: .handoff) ?? Handoff()
        changes = try values.decodeIfPresent([ChangeEntry].self, forKey: .changes) ?? []
        guard handoff.coveredProgressCount >= 0, handoff.coveredProgressCount <= progress.count,
              Set(progress.map(\.id)).count == progress.count,
              Set(changes.map(\.id)).count == changes.count else {
            throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath,
                                                    debugDescription: "交接摘要或记录编号无效"))
        }
    }

    // ISO-8601 persistence has second precision; compare the persisted representation.
    func hasSameContent(as other: Demand) -> Bool {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        encoder.outputFormatting = [.sortedKeys]
        return (try? encoder.encode(self)) == (try? encoder.encode(other))
    }

    func matches(_ query: String) -> Bool {
        let needle = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !needle.isEmpty else { return true }
        let fields = [title, project, notes, spell.codeEntry, spell.materials,
                spell.intent, spell.supplement, handoff.completed, handoff.pending,
                handoff.decisions, handoff.verification] + changes.map(\.text) + progress.map(\.text)
        return fields.contains {
            $0.localizedCaseInsensitiveContains(needle)
        }
    }
}

struct ChangeEntry: Codable, Identifiable, Equatable {
    var id = UUID()
    var createdAt = Date()
    var text: String
}

struct Handoff: Codable, Equatable {
    var completed = ""
    var pending = ""
    var decisions = ""
    var verification = ""
    var coveredProgressCount = 0

    var isEmpty: Bool {
        [completed, pending, decisions, verification].allSatisfy {
            $0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        }
    }

    var canSummarizeProgress: Bool {
        !pending.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
        !verification.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    func hasSameText(as other: Handoff) -> Bool {
        completed == other.completed && pending == other.pending &&
        decisions == other.decisions && verification == other.verification
    }

    var prompt: String {
        var sections = ["## 交接摘要\n以下是手动维护的任务现状；验证结论以实际记录为准。"]
        for (title, text) in [("已完成", completed), ("下一步", pending),
                              ("关键决定", decisions), ("验证结果", verification)] {
            if !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                sections.append("### \(title)\n\(text)")
            }
        }
        return sections.joined(separator: "\n\n")
    }
}
