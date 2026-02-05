// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "CapacitorPasskeys",
    platforms: [.iOS(.v16)],
    products: [
        .library(
            name: "PasskeysPlugin",
            targets: ["PasskeysPlugin"]
        )
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", branch: "main")
    ],
    targets: [
        .target(
            name: "PasskeysPlugin",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm")
            ],
            path: "Sources/PasskeysPlugin"
        )
    ]
)
