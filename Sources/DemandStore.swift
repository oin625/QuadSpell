import Foundation
import Combine

struct BoardData: Codable {
    var schemaVersion = 1
    var demands: [Demand]
}

@MainActor
final class DemandStore: ObservableObject {
    @Published private(set) var demands: [Demand] = []
    @Published private(set) var errorMessage: String?

    let fileURL: URL
    private var loadFailed = false

    init(fileURL: URL? = nil) {
        self.fileURL = fileURL ?? FileManager.default.urls(
            for: .applicationSupportDirectory, in: .userDomainMask
        )[0].appendingPathComponent("QuadSpell/demands.json")
        load()
    }

    func load() {
        guard FileManager.default.fileExists(atPath: fileURL.path) else {
            demands = []
            loadFailed = false
            errorMessage = nil
            return
        }
        do {
            let data = try Data(contentsOf: fileURL)
            let decoder = JSONDecoder()
            decoder.dateDecodingStrategy = .iso8601
            let board = try decoder.decode(BoardData.self, from: data)
            guard board.schemaVersion == 1 else {
                throw StoreError.unsupportedVersion
            }
            demands = board.demands
            loadFailed = false
            errorMessage = nil
        } catch {
            loadFailed = true
            errorMessage = "无法读取本地需求数据：\(error.localizedDescription)。原文件已保留，请先备份或修复后重新打开。"
        }
    }

    @discardableResult
    func upsert(_ demand: Demand) -> Bool {
        var next = demands
        var saved = demand
        saved.updatedAt = Date()
        if let index = next.firstIndex(where: { $0.id == saved.id }) {
            saved.createdAt = next[index].createdAt
            next[index] = saved
        } else {
            next.append(saved)
        }
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
    func remove(_ id: UUID) -> Bool {
        guard demands.contains(where: { $0.id == id }) else { return false }
        return commit(demands.filter { $0.id != id })
    }

    private func commit(_ next: [Demand]) -> Bool {
        guard !loadFailed else {
            errorMessage = "本地数据读取失败，已停止写入，避免覆盖原文件。"
            return false
        }
        do {
            let directory = fileURL.deletingLastPathComponent()
            try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
            let encoder = JSONEncoder()
            encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
            encoder.dateEncodingStrategy = .iso8601
            let data = try encoder.encode(BoardData(demands: next))
            try data.write(to: fileURL, options: .atomic)
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
        var errorDescription: String? {
            "数据版本比当前应用更新"
        }
    }
}
