import SwiftUI
import Foundation

extension ItemPriority {
    /// 语义色(深浅色自适应), 替代 dotColor 十六进制
    var color: Color {
        switch self {
        case .p0: return .red
        case .p1: return .blue
        case .p2: return .orange
        case .p3: return .secondary
        }
    }
}
// MARK: - 通用交互样式: 按压缩放+透明度, hover 抬升, 全面板共用

struct SmoothButtonStyle: ButtonStyle {
    var scale: CGFloat = 0.92
    var hoverScale: CGFloat = 1.06
    @State private var hovered = false
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .dboardClickTarget()
            .scaleEffect(configuration.isPressed ? scale : (hovered ? hoverScale : 1.0))
            .opacity(configuration.isPressed ? 0.7 : 1.0)
            .brightness(hovered && !configuration.isPressed ? 0.03 : 0)
            .animation(.spring(response: 0.25, dampingFraction: 0.55), value: configuration.isPressed)
            .animation(.spring(response: 0.28, dampingFraction: 0.7), value: hovered)
            .onHover { hovered = $0 }
            .contentShape(Rectangle())
    }
}

struct HoverLift: ViewModifier {
    var scale: CGFloat = 1.05
    @State private var hovered = false
    func body(content: Content) -> some View {
        content
            .scaleEffect(hovered ? scale : 1.0)
            .animation(.spring(response: 0.3, dampingFraction: 0.7), value: hovered)
            .onHover { hovered = $0 }
    }
}
