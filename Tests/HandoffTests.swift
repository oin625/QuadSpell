import Foundation
import Testing
@testable import QuadSpell

private func fixtureBoard(_ name: String) throws -> BoardData {
    let url = try #require(Bundle.module.url(forResource: name, withExtension: "json"))
    let decoder = JSONDecoder()
    decoder.dateDecodingStrategy = .iso8601
    return try decoder.decode(BoardData.self, from: Data(contentsOf: url))
}

private func temporaryDirectory() throws -> URL {
    let url = FileManager.default.temporaryDirectory.appendingPathComponent("QuadSpellHandoff-\(UUID())")
    try FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
    return url
}

@Test func newSharedFixturePreservesHandoffChangesAndUncoveredProgress() throws {
    let board = try fixtureBoard("handoff-board")
    #expect(board.schemaVersion == 2)
    let demand = try #require(board.demands.first)
    let prompt = demand.spell.prompt(for: demand)
    #expect(prompt.contains("### 下一步\n验证相同时间排序"))
    #expect(prompt.contains("C001"))
    #expect(prompt.contains("相同时间保持输入顺序"))
    #expect(prompt.contains("相同时间排序仍待验证"))
    #expect(!prompt.contains("完成排序实现"))
    #expect(demand.matches("回归尚未执行"))
    #expect(demand.matches("相同时间保持输入顺序"))
    let encoder = JSONEncoder()
    encoder.dateEncodingStrategy = .iso8601
    let decoder = JSONDecoder()
    decoder.dateDecodingStrategy = .iso8601
    let reopened = try decoder.decode(BoardData.self, from: encoder.encode(board))
    #expect(reopened.demands.first?.hasSameContent(as: demand) == true)
}

@Test @MainActor func oldDataMigratesOnlyWhenSaved() throws {
    let directory = try temporaryDirectory()
    defer { try? FileManager.default.removeItem(at: directory) }
    let fixture = try #require(Bundle.module.url(forResource: "mac-board", withExtension: "json"))
    let url = directory.appendingPathComponent("demands.json")
    let bytes = try Data(contentsOf: fixture)
    try bytes.write(to: url)
    let store = DemandStore(fileURL: url)
    #expect(try Data(contentsOf: url) == bytes)
    let original = try #require(store.demands.first)
    #expect(original.handoff.isEmpty)
    #expect(original.changes.isEmpty)
    #expect(store.upsert(original, expected: original, changeText: "保持稳定排序"))
    let decoded = try JSONSerialization.jsonObject(with: Data(contentsOf: url)) as! [String: Any]
    #expect(decoded["schemaVersion"] as? Int == 2)
    #expect(DemandStore(fileURL: url).demands.first?.changes.first?.text == "保持稳定排序")
}

@Test @MainActor func summaryCoversCurrentProgressAndKeepsLaterProgress() throws {
    let directory = try temporaryDirectory()
    defer { try? FileManager.default.removeItem(at: directory) }
    let store = DemandStore(fileURL: directory.appendingPathComponent("demands.json"))
    var demand = Demand()
    demand.title = "接续"
    demand.spell.intent = "完成任务"
    #expect(store.upsert(demand, progressText: "实现完成"))
    let original = try #require(store.demands.first)
    demand = original
    demand.handoff.completed = "实现完成"
    demand.handoff.pending = "完成回归"
    demand.handoff.verification = "测试未执行"
    #expect(store.upsert(demand, expected: original, progressText: "补充边界处理", changeText: "保留旧 API"))
    let summarized = try #require(store.demands.first)
    #expect(summarized.handoff.coveredProgressCount == 2)
    #expect(store.upsert(summarized, expected: summarized, progressText: "回归失败"))
    let latest = try #require(store.demands.first)
    #expect(latest.progress.count == 3)
    #expect(latest.changes.count == 1)
    let prompt = latest.spell.prompt(for: latest)
    #expect(prompt.contains("回归失败"))
    #expect(!prompt.contains("补充边界处理"))
    var cleared = latest
    cleared.handoff = Handoff()
    #expect(store.upsert(cleared, expected: latest))
    let restored = try #require(store.demands.first)
    #expect(restored.spell.prompt(for: restored).contains("补充边界处理"))
}

@Test @MainActor func partialSummaryDoesNotHidePendingHistory() throws {
    let directory = try temporaryDirectory()
    defer { try? FileManager.default.removeItem(at: directory) }
    let store = DemandStore(fileURL: directory.appendingPathComponent("demands.json"))
    var demand = Demand()
    demand.title = "未完整交接"
    demand.handoff.completed = "实现完成"
    #expect(store.upsert(demand, progressText: "回归仍待执行"))
    let saved = try #require(store.demands.first)
    #expect(saved.handoff.coveredProgressCount == 0)
    #expect(saved.spell.prompt(for: saved).contains("回归仍待执行"))
}

@Test @MainActor func staleEditorCannotReplaceNewerTask() throws {
    let directory = try temporaryDirectory()
    defer { try? FileManager.default.removeItem(at: directory) }
    let store = DemandStore(fileURL: directory.appendingPathComponent("demands.json"))
    var demand = Demand()
    demand.title = "原任务"
    #expect(store.upsert(demand))
    let original = try #require(store.demands.first)
    var updated = original
    updated.notes = "其他编辑器的修改"
    #expect(store.upsert(updated, expected: original))
    #expect(!store.upsert(original, expected: original, changeText: "旧草稿"))
    #expect(store.demands.first?.notes == updated.notes)
    #expect(!store.remove(original.id, expected: original))
}

@Test @MainActor func externalWritesAreNotOverwritten() throws {
    let directory = try temporaryDirectory()
    defer { try? FileManager.default.removeItem(at: directory) }
    let url = directory.appendingPathComponent("demands.json")
    let first = DemandStore(fileURL: url)
    var demand = Demand()
    demand.title = "原任务"
    #expect(first.upsert(demand))
    let original = try #require(first.demands.first)
    let second = DemandStore(fileURL: url)
    var updated = original
    updated.title = "外部更新"
    #expect(second.upsert(updated, expected: original))
    let bytes = try Data(contentsOf: url)
    #expect(!first.upsert(original, expected: original))
    #expect(try Data(contentsOf: url) == bytes)
    #expect(first.demands.first?.title == "外部更新")
}

@Test @MainActor func incompleteDraftSurvivesReopeningAndCanBeDiscarded() throws {
    let directory = try temporaryDirectory()
    defer { try? FileManager.default.removeItem(at: directory) }
    let url = directory.appendingPathComponent("drafts.json")
    var demand = Demand()
    demand.spell.codeEntry = "未写完的入口"
    let draft = EditorDraft(demand: demand, expected: nil,
                            progressText: "进展草稿", changeText: "变更草稿")
    #expect(EditorDraftStore(fileURL: url).save(draft))
    let reopened = EditorDraftStore(fileURL: url)
    #expect(reopened.drafts["new"]?.demand.spell.codeEntry == demand.spell.codeEntry)
    #expect(reopened.drafts["new"]?.progressText == "进展草稿")
    #expect(reopened.remove("new"))
    #expect(EditorDraftStore(fileURL: url).drafts.isEmpty)
}

@Test @MainActor func corruptDraftAndNewerDataArePreserved() throws {
    let directory = try temporaryDirectory()
    defer { try? FileManager.default.removeItem(at: directory) }
    let url = directory.appendingPathComponent("drafts.json")
    let bytes = Data("{broken".utf8)
    try bytes.write(to: url)
    let drafts = EditorDraftStore(fileURL: url)
    #expect(!drafts.save(EditorDraft(demand: Demand(), expected: nil)))
    #expect(try Data(contentsOf: url) == bytes)
    let boardURL = directory.appendingPathComponent("demands.json")
    let future = Data(#"{"schemaVersion":3,"demands":[]}"#.utf8)
    try future.write(to: boardURL)
    let store = DemandStore(fileURL: boardURL)
    var demand = Demand()
    demand.title = "不应覆盖"
    #expect(!store.upsert(demand))
    #expect(try Data(contentsOf: boardURL) == future)
}

@Test @MainActor func draftConflictRemainsBlockedUntilExplicitReload() throws {
    let directory = try temporaryDirectory()
    defer { try? FileManager.default.removeItem(at: directory) }
    let url = directory.appendingPathComponent("drafts.json")
    let first = EditorDraftStore(fileURL: url)
    let second = EditorDraftStore(fileURL: url)
    var demand = Demand()
    demand.notes = "另一个窗口"
    #expect(second.save(EditorDraft(demand: demand, expected: nil)))
    let bytes = try Data(contentsOf: url)
    #expect(!first.save(EditorDraft(demand: Demand(), expected: nil)))
    #expect(!first.save(EditorDraft(demand: Demand(), expected: nil)))
    #expect(try Data(contentsOf: url) == bytes)
    first.load()
    #expect(first.drafts["new"]?.demand.notes == demand.notes)
}
