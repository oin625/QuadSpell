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
        if !demand.progress.isEmpty {
            let history = demand.progress.map { entry in
                "- \(entry.createdAt.formatted(date: .numeric, time: .shortened))：\(entry.text)"
            }.joined(separator: "\n")
            sections.append("## 已记录的进度\n\(history)")
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

    func matches(_ query: String) -> Bool {
        let needle = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !needle.isEmpty else { return true }
        return [title, project, notes, spell.codeEntry, spell.materials,
                spell.intent, spell.supplement].contains {
            $0.localizedCaseInsensitiveContains(needle)
        }
    }
}
