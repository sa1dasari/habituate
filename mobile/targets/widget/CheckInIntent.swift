import AppIntents
import Foundation
import WidgetKit

/// The interactive check-in action for iOS 17+ widgets (`Button(intent:)`
/// in `CheckInWidget.swift`). This runs INSIDE the widget extension's own
/// process when the OS invokes it — no app launch, no React Native, no
/// Firebase JS SDK. Everything it needs comes from `SharedStore` (the App
/// Group) and plain `URLSession` calls:
///
/// 1. Read the cached auth bundle. If there isn't one (signed out, or the
///    main app has never opened since this device set up the widget),
///    give up — WidgetKit's own `OpenURLIntent` fallback on the view side
///    (`CheckInWidget.swift`'s pre-iOS-17 branch) is what actually opens
///    the app in that case, but a Button-intent action itself can't open
///    the host app, so we just no-op and let the next tap after the user
///    has opened the app once succeed.
/// 2. If the cached Firebase ID token is expired (or expires in under a
///    minute), mint a fresh one ourselves — purely over HTTPS, no SDK —
///    via Google's Secure Token Service using the cached refresh token.
///    This is the standard, documented way to refresh a Firebase ID token
///    outside the SDK (`POST https://securetoken.googleapis.com/v1/token`),
///    and it's what makes this extension's interactivity last far beyond
///    the ~1 hour an ID token is normally valid for.
/// 3. Call the real check-in endpoint
///    (`POST {apiBaseUrl}/api/habits/{habitId}/check-ins`) exactly like the
///    main app does, with that Bearer token — `FirebaseAuthFilter` on the
///    backend neither knows nor cares that the caller is a widget.
/// 4. Update the cached snapshot optimistically and ask WidgetKit to
///    reload, so the tap visibly completes without a full app open.
struct CheckInIntent: AppIntent {
    static var title: LocalizedStringResource = "Check in"
    static var description = IntentDescription("Logs today's check-in for a habit directly from the widget.")

    @Parameter(title: "Habit ID")
    var habitId: Int

    init() {}
    init(habitId: Int) {
        self.habitId = habitId
    }

    func perform() async throws -> some IntentResult {
        guard var auth = SharedStore.readAuth() else {
            return .result()
        }

        if isExpiredOrExpiringSoon(auth.expiresAt) {
            if let refreshed = try? await refreshIdToken(using: auth) {
                auth = refreshed
                SharedStore.writeAuth(refreshed)
            } else {
                // Refresh failed (revoked session, offline, etc) — nothing
                // more this extension can safely do; the user opening the
                // app normally will re-authenticate and re-sync.
                return .result()
            }
        }

        let didCheckIn = try? await postCheckIn(habitId: habitId, auth: auth)
        if didCheckIn == true {
            applyOptimisticUpdate(habitId: habitId)
            WidgetCenter.shared.reloadAllTimelines()
        }

        return .result()
    }

    private func isExpiredOrExpiringSoon(_ iso8601: String) -> Bool {
        guard let expiry = ISO8601DateFormatter().date(from: iso8601) else { return true }
        return expiry.timeIntervalSinceNow < 60
    }

    /// Plain REST call to Google's Secure Token Service — the same
    /// mechanism Firebase's own SDKs use internally, just invoked directly
    /// since this extension has no SDK available to it.
    private func refreshIdToken(using auth: SharedStore.AuthPayload) async throws -> SharedStore.AuthPayload {
        guard !auth.apiKey.isEmpty,
              let url = URL(string: "https://securetoken.googleapis.com/v1/token?key=\(auth.apiKey)")
        else { throw URLError(.badURL) }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
        let body = "grant_type=refresh_token&refresh_token=\(auth.refreshToken)"
        request.httpBody = body.data(using: .utf8)

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, http.statusCode == 200 else {
            throw URLError(.userAuthenticationRequired)
        }

        struct TokenResponse: Decodable {
            let id_token: String
            let refresh_token: String
            let expires_in: String // seconds, as a string per this API's own quirky shape
        }
        let decoded = try JSONDecoder().decode(TokenResponse.self, from: data)
        let expiresAt = Date().addingTimeInterval(Double(decoded.expires_in) ?? 3600)

        return SharedStore.AuthPayload(
            idToken: decoded.id_token,
            refreshToken: decoded.refresh_token,
            expiresAt: ISO8601DateFormatter().string(from: expiresAt),
            apiKey: auth.apiKey,
            apiBaseUrl: auth.apiBaseUrl
        )
    }

    /// Mirrors `api/client.js`'s `request()` for exactly this one call:
    /// Bearer auth + the same `X-Timezone` header the backend buckets
    /// streaks by, against the SAME endpoint the Today screen's check-in
    /// button calls. No backend changes were needed for this feature —
    /// `POST /api/habits/{id}/check-ins` already accepts an empty body.
    private func postCheckIn(habitId: Int, auth: SharedStore.AuthPayload) async throws -> Bool {
        guard let url = URL(string: "\(auth.apiBaseUrl)/api/habits/\(habitId)/check-ins") else {
            throw URLError(.badURL)
        }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(auth.idToken)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let tz = TimeZone.current.identifier as String? {
            request.setValue(tz, forHTTPHeaderField: "X-Timezone")
        }

        let (_, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else { return false }
        // 201 = created; 409 = already checked in today, which for a tap
        // on an already-"done" row (shouldn't normally happen — the view
        // hides the button once done) is still a fine outcome to treat as
        // success rather than surfacing an error from a widget.
        return http.statusCode == 201 || http.statusCode == 409
    }

    private func applyOptimisticUpdate(habitId: Int) {
        var habits = SharedStore.readSnapshot()
        guard let index = habits.firstIndex(where: { $0.id == habitId }) else { return }
        let old = habits[index]
        habits[index] = SharedStore.HabitSnapshot(
            id: old.id,
            name: old.name,
            color: old.color,
            category: old.category,
            currentStreak: old.currentStreak + 1,
            checkedInToday: true,
            trackingMode: old.trackingMode
        )
        SharedStore.writeSnapshot(habits)
    }
}
