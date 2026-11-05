import Foundation
import Testing
@testable import QuadSpell

@Test func quadrantOrderMatchesAxes() {
    #expect(Quadrant.rows == [
        [.importantNotUrgent, .importantUrgent],
        [.notImportantNotUrgent, .notImportantUrgent]
    ])
}

@Test func spellRequiresIntentAndBuildsPortablePrompt() {
    var demand = Demand()
    demand.title = "搜索更快"
    demand.project = "示例项目"
    demand.spell.codeEntry = "搜索模块"
    #expect(!demand.spell.isValid)
    demand.spell.intent = "输入关键词后立即显示匹配结果。"
    #expect(demand.spell.isValid)
    let prompt = demand.spell.prompt(for: demand)
    #expect(prompt.contains("搜索模块"))
    #expect(prompt.contains("请先定位并阅读相关实现"))
    #expect(prompt.contains(demand.spell.intent))
    #expect(!prompt.contains("/Users/"))
}

@Test @MainActor func storePersistsAndMovesDemands() throws {
    let directory = FileManager.default.temporaryDirectory
        .appendingPathComponent("QuadSpellTests-\(UUID().uuidString)")
    defer { try? FileManager.default.removeItem(at: directory) }
    let url = directory.appendingPathComponent("demands.json")
    let store = DemandStore(fileURL: url)
    var demand = Demand()
    demand.title = "测试持久化"
    demand.dueDate = Date(timeIntervalSince1970: 1_800_000_000)
    #expect(store.upsert(demand))
    #expect(store.move(demand.id, to: .importantUrgent))
    let reopened = DemandStore(fileURL: url)
    #expect(reopened.demands.count == 1)
    #expect(reopened.demands[0].quadrant == .importantUrgent)
    #expect(reopened.demands[0].dueDate != nil)
}

@Test @MainActor func corruptDataIsNeverOverwritten() throws {
    let directory = FileManager.default.temporaryDirectory
        .appendingPathComponent("QuadSpellTests-\(UUID().uuidString)")
    defer { try? FileManager.default.removeItem(at: directory) }
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    let url = directory.appendingPathComponent("demands.json")
    let original = Data("{broken".utf8)
    try original.write(to: url)
    let store = DemandStore(fileURL: url)
    #expect(store.errorMessage != nil)
    var demand = Demand()
    demand.title = "不应写入"
    #expect(!store.upsert(demand))
    #expect(try Data(contentsOf: url) == original)
}
