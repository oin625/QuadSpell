// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "QuadSpell",
    platforms: [.macOS(.v14)],
    products: [.executable(name: "QuadSpell", targets: ["QuadSpell"])],
    targets: [
        .executableTarget(name: "QuadSpell", path: "Sources"),
        .testTarget(name: "QuadSpellTests", dependencies: ["QuadSpell"], path: "Tests")
    ]
)
