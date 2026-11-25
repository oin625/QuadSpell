import SwiftUI
import AppKit
import UserNotifications

struct DBoardModule: Identifiable {
    static var visible: [DBoardModule] { all }
    let id: String
    let title: String
    let icon: String
    private let defaultShortcut: String
    var shortcut: String {
        let shortcutID = id
        guard ShortcutPreferences.defaultsBindings[shortcutID] != nil else { return defaultShortcut }
        return ShortcutPreferences.shared.binding(for: shortcutID)?.title ?? ""
    }
    var searchText: String { ([title, id] + aliases).joined(separator: " ").lowercased() }
    private var aliases: [String] {
        switch id {
        case "clipboard": return ["剪贴板", "复制", "粘贴", "clip"]
        case "skills": return ["技能", "MCP", "Hook", "Agent", "上下文", "Context"]
        case "activitymonitor": return ["活动监视器", "Activity Monitor", "卡顿", "CPU", "内存", "进程"]
        case "githubtrending": return ["GitHub", "热门", "开源", "项目", "趋势", "排名", "trending"]
        default: return []
        }
    }
    init(id: String, title: String, icon: String, shortcut: String, open: @escaping () -> Void) {
        self.id = id; self.title = title; self.icon = icon
        defaultShortcut = shortcut; self.open = open
    }
    let open: () -> Void

    func launch() {
        NotificationCenter.default.post(name: .init("DBoardModuleWillOpen"), object: id)
        UsageStats.hit(id)
        WorkspacePreferences.shared.remember(id)
        open()
    }

    private static func post(_ name: String) { NotificationCenter.default.post(name: .init(name), object: nil) }

    static let all: [DBoardModule] = [
        DBoardModule(id: "clipboard", title: "剪切板历史", icon: "doc.on.clipboard", shortcut: "⌥V") { ClipboardBoardWindowController.shared.show() },
        DBoardModule(id: "skills", title: "Skills 看板", icon: "wand.and.stars", shortcut: "") { post("openSkillsBoard") },
        DBoardModule(id: "githubtrending", title: "GitHub 热门", icon: "chart.line.uptrend.xyaxis", shortcut: "") { post("openGitHubTrending") },
        DBoardModule(id: "activitymonitor", title: "打开活动监视器", icon: "waveform.path.ecg", shortcut: "") {
            NSWorkspace.shared.open(URL(fileURLWithPath: "/System/Applications/Utilities/Activity Monitor.app"))
        },
    ]
}

// MARK: - 模块使用统计(纯本地, 用来决定哪些模块该冻结/下线)
enum UsageStats {
    private static let path = NSHomeDirectory() + "/Library/Application Support/DBoard-Personal/usage.json"
    private static let queue = DispatchQueue(label: "dboard.usage")

    /// 结构: { "模块id": { "yyyy-MM-dd": 次数 } }
    static func hit(_ id: String) {
        queue.async {
            var db = load()
            let day = dayFmt.string(from: Date())
            db[id, default: [:]][day, default: 0] += 1
            let dir = (path as NSString).deletingLastPathComponent
            try? FileManager.default.createDirectory(atPath: dir, withIntermediateDirectories: true)
            if let data = try? JSONSerialization.data(withJSONObject: db, options: [.prettyPrinted, .sortedKeys]) {
                try? data.write(to: URL(fileURLWithPath: path), options: .atomic)
            }
        }
    }

    /// 近 N 天各模块打开次数, 降序
    static func summary(days: Int = 14) -> [(String, Int)] {
        let db = queue.sync { load() }
        let cutoff = dayFmt.string(from: Date().addingTimeInterval(-Double(days) * 86400))
        // 保留历史数据，统计只展示仍在使用的模块和主面板。
        let activeIDs = Set(DBoardModule.all.map(\.id)).union(["dboard"])
        return db.filter { activeIDs.contains($0.key) }
            .map { (id, perDay) in (id, perDay.filter { $0.key >= cutoff }.values.reduce(0, +)) }
            .sorted { $0.1 > $1.1 }
    }

    private static func load() -> [String: [String: Int]] {
        guard let data = FileManager.default.contents(atPath: path),
              let obj = try? JSONSerialization.jsonObject(with: data) as? [String: [String: Int]] else { return [:] }
        return obj
    }

    private static let dayFmt: DateFormatter = {
        let f = DateFormatter(); f.locale = Locale(identifier: "en_US_POSIX"); f.dateFormat = "yyyy-MM-dd"; return f
    }()
}
