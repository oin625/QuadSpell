import SwiftUI

@main
struct QuadSpellApp: App {
    var body: some Scene {
        WindowGroup("QuadSpell · 四象咒言") {
            DemandBoardView()
        }
        .defaultSize(width: 1060, height: 780)
    }
}
