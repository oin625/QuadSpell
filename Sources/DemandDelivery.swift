import Foundation
import SwiftUI
import AppKit
import Darwin

enum DemandDeliveryError: LocalizedError {
    case message(String)
    case missingTechnicalPlan(DItem)
    var errorDescription: String? {
        switch self {
        case .message(let value): return value
        case .missingTechnicalPlan: return "尚未准备技术方案，请先复制方案指令交给 AI。"
        }
    }
}

struct DemandDeliveryProject: Codable, Equatable {
    let name: String
    let branch: String
    var declaration: String { name + ":" + branch }

    static func name(_ value: String) -> String {
        let path = NSString(string: value.trimmed).expandingTildeInPath
        return path.contains("/") ? URL(fileURLWithPath: path).lastPathComponent : path
    }

    static func validName(_ value: String) -> Bool {
        !value.isEmpty && !["待定", "待补充", "（待补充）"].contains(value)
            && value.range(of: #"^[A-Za-z0-9_.-]+$"#, options: .regularExpression) != nil
    }

    static func isIntegrationBranch(_ value: String) -> Bool {
        let branch = value.lowercased()
        return ["pre", "staging", "release", "integration"].contains(branch) ||
            branch.hasPrefix("merge/") || branch.hasPrefix("integration/") || branch.hasPrefix("release/")
    }

    static func validBranch(_ value: String) -> Bool {
        !value.isEmpty && !["待定", "待补充", "HEAD"].contains(value)
            && !value.contains("..") && !value.contains("@{")
            && value.rangeOfCharacter(from: CharacterSet(charactersIn: " ,;，；：:\\~^?*[\n\r\t")) == nil
            && !value.hasPrefix("-") && !value.hasSuffix("/") && !value.hasSuffix(".lock")
    }
}
