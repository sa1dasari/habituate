import WidgetKit
import SwiftUI

/// Entry point for the WidgetKit extension target `@bacons/apple-targets`
/// generates from `expo-target.config.js`. Only one widget kind exists
/// today (`CheckInWidget`, small/medium/large) — a second `@main` struct
/// isn't needed unless a future widget (e.g. a dedicated Shared
/// Habit/Challenge widget) is added, at which point it'd be listed here
/// too rather than as a second extension target.
@main
struct HabituateWidgetBundle: WidgetBundle {
    var body: some Widget {
        CheckInWidget()
    }
}
