import Foundation

/// Reads the two JSON blobs the main app's JS side writes into the shared
/// App Group container (`mobile/utils/widgetSync.js`). This is the ONLY
/// channel between this extension's Swift process and the React Native
/// app's process — a WidgetKit extension does not share the app's JS
/// runtime, AsyncStorage, or Firebase session at all, unlike the Android
/// widget's headless-JS-task approach (see `widgets/widgetTaskHandler.js`
/// for that contrast).
enum SharedStore {
    // MUST match `IOS_APP_GROUP` in `mobile/utils/widgetSync.js` and the
    // entitlement in `expo-target.config.js` / the main app's own
    // entitlements. See that file's comment for the manual Apple Developer
    // portal step this also depends on.
    static let appGroupId = "group.com.habituate.mobile.widget"

    private static var defaults: UserDefaults? {
        UserDefaults(suiteName: appGroupId)
    }

    struct HabitSnapshot: Codable {
        let id: Int
        let name: String
        let color: String
        let category: String
        let currentStreak: Int
        let checkedInToday: Bool
        let trackingMode: String
    }

    struct SnapshotPayload: Codable {
        let habits: [HabitSnapshot]
        let updatedAt: String
    }

    struct AuthPayload: Codable {
        let idToken: String
        let refreshToken: String
        let expiresAt: String // ISO8601
        let apiKey: String
        let apiBaseUrl: String
    }

    static func readSnapshot() -> [HabitSnapshot] {
        // `react-native-shared-group-preferences` stores values under the
        // RN-side key, JSON-encoded as a plain string — mirrors what
        // `syncHabitSnapshot` in widgetSync.js writes.
        guard let raw = defaults?.string(forKey: "@habituate/widget-snapshot"),
              let data = raw.data(using: .utf8),
              let decoded = try? JSONDecoder().decode(SnapshotPayload.self, from: data)
        else { return [] }
        return decoded.habits
    }

    static func readAuth() -> AuthPayload? {
        guard let raw = defaults?.string(forKey: "@habituate/widget-auth"),
              !raw.isEmpty,
              let data = raw.data(using: .utf8),
              let decoded = try? JSONDecoder().decode(AuthPayload.self, from: data)
        else { return nil }
        return decoded
    }

    /// Lets the widget's own optimistic update (after a successful
    /// in-widget check-in) persist back into the snapshot, so re-opening
    /// the widget gallery or the main app doesn't show a stale "not done
    /// yet" state until the next full app-side refresh overwrites it.
    static func writeSnapshot(_ habits: [HabitSnapshot]) {
        let payload = SnapshotPayload(habits: habits, updatedAt: ISO8601DateFormatter().string(from: Date()))
        guard let data = try? JSONEncoder().encode(payload),
              let json = String(data: data, encoding: .utf8)
        else { return }
        defaults?.set(json, forKey: "@habituate/widget-snapshot")
    }

    /// Persists a freshly-minted ID token (see `CheckInIntent.refreshIdTokenIfNeeded`)
    /// back into the App Group so the next widget tap reuses it instead of
    /// hitting `securetoken.googleapis.com` again before it's actually expired.
    static func writeAuth(_ auth: AuthPayload) {
        guard let data = try? JSONEncoder().encode(auth),
              let json = String(data: data, encoding: .utf8)
        else { return }
        defaults?.set(json, forKey: "@habituate/widget-auth")
    }
}
