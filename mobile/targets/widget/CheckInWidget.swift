import SwiftUI
import WidgetKit

/// WidgetKit timeline entry — just a snapshot read, never a live network
/// call (the platform-recommended pattern: keep timeline providers cheap
/// and let the main app or `CheckInIntent` push fresh data into the App
/// Group instead). `getTimeline` asks for a reload in 15 minutes as a
/// backstop; the real freshness comes from the app's own
/// `syncHabitSnapshot` writes and `WidgetCenter.reloadAllTimelines()`
/// calls after an in-widget check-in.
struct CheckInEntry: TimelineEntry {
    let date: Date
    let habits: [SharedStore.HabitSnapshot]
}

struct CheckInProvider: TimelineProvider {
    func placeholder(in context: Context) -> CheckInEntry {
        CheckInEntry(date: Date(), habits: [])
    }

    func getSnapshot(in context: Context, completion: @escaping (CheckInEntry) -> Void) {
        completion(CheckInEntry(date: Date(), habits: SharedStore.readSnapshot()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<CheckInEntry>) -> Void) {
        let entry = CheckInEntry(date: Date(), habits: SharedStore.readSnapshot())
        let nextReload = Calendar.current.date(byAdding: .minute, value: 15, to: Date()) ?? Date()
        completion(Timeline(entries: [entry], policy: .after(nextReload)))
    }
}

/// Colors mirror `theme.js`'s light palette — a widget's surface always
/// renders in the system's current appearance (SwiftUI handles light/dark
/// automatically via the named asset-catalog colors `@bacons/apple-targets`
/// generates from `expo-target.config.js`'s `colors` map), so there's no
/// separate dark-mode branch to hand-maintain here the way
/// `useAppTheme()` requires for in-app React Native screens.
private func dotColor(for habit: SharedStore.HabitSnapshot) -> Color {
    habit.checkedInToday ? Color("$safe") : Color(hex: habit.color) ?? Color("$accent")
}

private struct HabitRow: View {
    let habit: SharedStore.HabitSnapshot
    let compact: Bool

    var body: some View {
        HStack(spacing: 8) {
            Circle().fill(dotColor(for: habit)).frame(width: 9, height: 9)
            Text(habit.name)
                .font(.system(size: compact ? 13 : 14, weight: .semibold))
                .foregroundColor(Color("$textPrimary"))
                .lineLimit(1)
            Spacer()
            if !compact, habit.currentStreak > 0 {
                Text("\(habit.currentStreak)🔥")
                    .font(.system(size: 11))
                    .foregroundColor(Color("$textSecondary"))
            }
            if habit.checkedInToday {
                Image(systemName: "checkmark.circle.fill")
                    .foregroundColor(Color("$safe"))
            } else if #available(iOS 17.0, *) {
                Button(intent: CheckInIntent(habitId: habit.id)) {
                    Image(systemName: "plus.circle.fill")
                        .foregroundColor(Color("$accent"))
                }
                .buttonStyle(.plain)
            } else {
                // Pre-iOS-17 degraded path: no App Intents support for
                // interactive widget buttons at all, so the ENTIRE row's
                // tap target (via the widget-level `.widgetURL` below)
                // opens the app straight onto this habit's check-in
                // instead of performing it in place. Documented tradeoff,
                // not an oversight — see the final report.
                Image(systemName: "plus.circle.fill")
                    .foregroundColor(Color("$accent"))
            }
        }
    }
}

struct CheckInWidgetView: View {
    @Environment(\.widgetFamily) var family
    let entry: CheckInEntry

    var body: some View {
        let notDone = entry.habits.filter { !$0.checkedInToday }
        let ranked = notDone + entry.habits.filter { $0.checkedInToday }

        if ranked.isEmpty {
            emptyState
        } else {
            let maxRows: Int = {
                switch family {
                case .systemSmall: return 1
                case .systemMedium: return 3
                default: return 5
                }
            }()
            VStack(alignment: .leading, spacing: 6) {
                if family != .systemSmall {
                    Text("Due today")
                        .font(.system(size: 11))
                        .foregroundColor(Color("$textSecondary"))
                }
                ForEach(ranked.prefix(maxRows), id: \.id) { habit in
                    HabitRow(habit: habit, compact: family == .systemSmall)
                }
            }
            .padding(12)
            .widgetURL(deepLink(for: ranked.first))
        }
    }

    private var emptyState: some View {
        VStack {
            Text("You're all caught up today.")
                .font(.system(size: 13))
                .foregroundColor(Color("$textSecondary"))
                .multilineTextAlignment(.center)
        }
        .padding(12)
        .widgetURL(URL(string: "habituate://"))
    }

    /// Only actually used as the TAP target on iOS 16 and below, or on 17+
    /// when the tap lands outside the per-row button — the same
    /// `habituate://checkin?habitId=` deep link `App.js`'s
    /// `WidgetDeepLinkBridge` listens for on the Android side too.
    private func deepLink(for habit: SharedStore.HabitSnapshot?) -> URL? {
        guard let habit, !habit.checkedInToday else { return URL(string: "habituate://") }
        return URL(string: "habituate://checkin?habitId=\(habit.id)&source=widget")
    }
}

struct CheckInWidget: Widget {
    let kind = "CheckInWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: CheckInProvider()) { entry in
            CheckInWidgetView(entry: entry)
                .containerBackground(Color("$background"), for: .widget)
        }
        .configurationDisplayName("Habituate Check-In")
        .description("Check in on today's habits without opening the app.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}

private extension Color {
    /// Habit colors are stored as plain hex strings in Postgres (`habits.color`)
    /// — not a SwiftUI-native format, so this converts the same value the
    /// in-app `HabitCard` already renders with `expo-linear-gradient`/flat
    /// fills.
    init?(hex: String) {
        var sanitized = hex.trimmingCharacters(in: .whitespacesAndNewlines)
        sanitized = sanitized.replacingOccurrences(of: "#", with: "")
        guard sanitized.count == 6, let value = UInt64(sanitized, radix: 16) else { return nil }
        let r = Double((value >> 16) & 0xFF) / 255
        let g = Double((value >> 8) & 0xFF) / 255
        let b = Double(value & 0xFF) / 255
        self = Color(red: r, green: g, blue: b)
    }
}
