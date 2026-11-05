import Foundation
import Testing
@testable import QuadSpell

@Test func nativeAppReadsSharedJSONFixture() throws {
    let url = try #require(Bundle.module.url(forResource: "mac-board", withExtension: "json"))
    let decoder = JSONDecoder()
    decoder.dateDecodingStrategy = .iso8601
    let board = try decoder.decode(BoardData.self, from: Data(contentsOf: url))
    #expect(board.schemaVersion == 1)
    #expect(board.demands.count == 1)
    #expect(board.demands[0].title == "示例需求")
    #expect(board.demands[0].progress.first?.text == "已完成数据结构设计")
}
