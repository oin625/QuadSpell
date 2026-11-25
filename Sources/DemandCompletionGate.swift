import Foundation

/// Completion belongs to the user; an AI test milestone never stands in for formal acceptance.
enum DemandCompletionGate {
    static func localIssue(_ item: DItem) -> String? {
        if let error = item.incidentReadError { return error }
        if let error = item.releaseChecklistReadError { return error }
        let pending = item.releaseChecklist.items.filter { !$0.done }
        guard pending.isEmpty else {
            return "还有 \(pending.count) 项上线前事项未完成：\(pending.prefix(3).map(\.text).joined(separator: "、"))。请完成并勾选后再归档。"
        }
        return nil
    }

    static func needsEmptyChecklistConfirmation(_ item: DItem) -> Bool {
        !item.isIncident && item.releaseChecklistReadError == nil && item.releaseChecklist.items.isEmpty
    }

}
