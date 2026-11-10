import Foundation
import Combine

struct EditorDraft: Codable, Equatable {
    var demand: Demand
    var expected: Demand?
    var progressText = ""
    var changeText = ""

    var key: String { expected == nil ? "new" : demand.id.uuidString }
}

@MainActor
final class EditorDraftStore: ObservableObject {
    @Published private(set) var drafts: [String: EditorDraft] = [:]
    @Published private(set) var errorMessage: String?
    let fileURL: URL
    private var loadedData: Data?
    private var loadFailed = false

    private struct File: Codable {
        var schemaVersion = 1
        var drafts: [String: EditorDraft]
    }

    init(fileURL: URL? = nil) {
        self.fileURL = fileURL ?? FileManager.default.urls(
            for: .applicationSupportDirectory, in: .userDomainMask
        )[0].appendingPathComponent("QuadSpell/drafts.json")
        load()
    }

    func load() {
        do {
            guard FileManager.default.fileExists(atPath: fileURL.path) else {
                drafts = [:]
                loadedData = nil
                loadFailed = false
                errorMessage = nil
                return
            }
            let data = try Data(contentsOf: fileURL)
            let decoder = JSONDecoder()
            decoder.dateDecodingStrategy = .iso8601
            let file = try decoder.decode(File.self, from: data)
            guard file.schemaVersion == 1,
                  file.drafts.allSatisfy({ key, draft in
                      key == draft.key && (draft.expected == nil || draft.expected?.id == draft.demand.id)
                  }) else {
                throw DemandStore.StoreError.unsupportedVersion
            }
            drafts = file.drafts
            loadedData = data
            loadFailed = false
            errorMessage = nil
        } catch {
            loadFailed = true
            errorMessage = "草稿无法读取，原文件已保留：\(error.localizedDescription)"
        }
    }

    @discardableResult
    func save(_ draft: EditorDraft) -> Bool {
        var next = drafts
        next[draft.key] = draft
        return commit(next)
    }

    @discardableResult
    func remove(_ key: String) -> Bool {
        guard drafts[key] != nil else { return !loadFailed }
        var next = drafts
        next.removeValue(forKey: key)
        return commit(next)
    }

    private func commit(_ next: [String: EditorDraft]) -> Bool {
        guard !loadFailed else { return false }
        do {
            let diskData = FileManager.default.fileExists(atPath: fileURL.path)
                ? try Data(contentsOf: fileURL) : nil
            guard diskData == loadedData else {
                load()
                loadFailed = true
                errorMessage = "草稿文件已被其他窗口修改，当前输入仍保留；请先复制备份并重新打开。"
                return false
            }
            let encoder = JSONEncoder()
            encoder.dateEncodingStrategy = .iso8601
            encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
            let data = try encoder.encode(File(drafts: next))
            try FileManager.default.createDirectory(at: fileURL.deletingLastPathComponent(),
                                                    withIntermediateDirectories: true)
            try data.write(to: fileURL, options: .atomic)
            loadedData = data
            drafts = next
            errorMessage = nil
            return true
        } catch {
            errorMessage = "草稿保存失败，输入仍保留：\(error.localizedDescription)"
            return false
        }
    }
}
