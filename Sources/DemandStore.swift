import Foundation
import Combine

struct BoardData: Codable {
    var schemaVersion = 2
    var demands: [Demand]
}

@MainActor
final class DemandStore: ObservableObject {
    @Published private(set) var demands: [Demand] = []
    @Published private(set) var errorMessage: String?

    let fileURL: URL
    private var loadFailed = false
    private var loadedData: Data?

    init(fileURL: URL? = nil) {
        self.fileURL = fileURL ?? FileManager.default.urls(
            for: .applicationSupportDirectory, in: .userDomainMask
        )[0].appendingPathComponent("QuadSpell/demands.json")
        load()
    }

    func load() {
        guard FileManager.default.fileExists(atPath: fileURL.path) else {
            demands = []
            loadedData = nil
            loadFailed = false
            errorMessage = nil
            return
        }
        do {
            let data = try Data(contentsOf: fileURL)
            let decoder = JSONDecoder()
            decoder.dateDecodingStrategy = .iso8601
            let board = try decoder.decode(BoardData.self, from: data)
            guard [1, 2].contains(board.schemaVersion),
                  Set(board.demands.map(\.id)).count == board.demands.count else {
                throw StoreError.unsupportedVersion
            }
            demands = board.demands
            loadedData = data
            loadFailed = false
            errorMessage = nil
        } catch {
            loadFailed = true
            errorMessage = "无法读取本地需求数据：\(error.localizedDescription)。原文件已保留，请先备份或修复后重新打开。"
        }
    }

    @discardableResult
    func upsert(_ demand: Demand, expected: Demand? = nil,
                progressText: String = "", changeText: String = "") -> Bool {
        var next = demands
        var saved = demand
        let index = next.firstIndex(where: { $0.id == saved.id })
        guard (index == nil && expected == nil) ||
                (index != nil && expected != nil && next[index!].hasSameContent(as: expected!)) else {
            errorMessage = "需求已发生变化，输入与草稿已保留；请关闭后重新打开并核对，避免覆盖新内容。"
            return false
        }
        guard !saved.title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
              saved.spell.isValid else {
            errorMessage = "请填写标题；填写咒言时“要做什么”必填。"
            return false
        }
        let progress = progressText.trimmingCharacters(in: .whitespacesAndNewlines)
        if !progress.isEmpty { saved.progress.append(ProgressEntry(text: progress)) }
        let change = changeText.trimmingCharacters(in: .whitespacesAndNewlines)
        if !change.isEmpty { saved.changes.append(ChangeEntry(text: change)) }
        if !saved.handoff.hasSameText(as: expected?.handoff ?? Handoff()) {
            saved.handoff.coveredProgressCount = saved.handoff.canSummarizeProgress ? saved.progress.count : 0
        }
        guard saved.handoff.coveredProgressCount >= 0,
              saved.handoff.coveredProgressCount <= saved.progress.count else {
            errorMessage = "交接摘要与进度记录不匹配。"
            return false
        }
        saved.updatedAt = Date()
        if let index {
            saved.createdAt = next[index].createdAt
            next[index] = saved
        } else { next.append(saved) }
        return commit(next)
    }

    @discardableResult
    func move(_ id: UUID, to quadrant: Quadrant) -> Bool {
        guard let index = demands.firstIndex(where: { $0.id == id }) else { return false }
        var next = demands
        next[index].quadrant = quadrant
        next[index].updatedAt = Date()
        return commit(next)
    }

    @discardableResult
    func remove(_ id: UUID, expected: Demand? = nil) -> Bool {
        guard let current = demands.first(where: { $0.id == id }) else { return false }
        if let expected, !current.hasSameContent(as: expected) {
            errorMessage = "需求已发生变化，请重新打开核对后再删除。"
            return false
        }
        return commit(demands.filter { $0.id != id })
    }

    private func commit(_ next: [Demand]) -> Bool {
        guard !loadFailed else {
            errorMessage = "本地数据读取失败，已停止写入，避免覆盖原文件。"
            return false
        }
        do {
            let diskData = FileManager.default.fileExists(atPath: fileURL.path)
                ? try Data(contentsOf: fileURL) : nil
            guard diskData == loadedData else {
                load()
                errorMessage = "本地数据已被其他窗口或程序修改，输入与草稿已保留；请重新打开需求核对后再保存。"
                return false
            }
            let directory = fileURL.deletingLastPathComponent()
            try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
            let encoder = JSONEncoder()
            encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
            encoder.dateEncodingStrategy = .iso8601
            let data = try encoder.encode(BoardData(demands: next))
            try data.write(to: fileURL, options: .atomic)
            loadedData = data
            demands = next
            errorMessage = nil
            return true
        } catch {
            errorMessage = "保存失败：\(error.localizedDescription)。当前输入仍保留在编辑窗口。"
            return false
        }
    }

    enum StoreError: LocalizedError {
        case unsupportedVersion
        var errorDescription: String? { "数据版本不受支持或存在重复编号" }
    }
}
