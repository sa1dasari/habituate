# STATE.md — Honest audit, 2026-11-02

Written by reading `SKILLS.md`/`CLAUDE.md`/`docs/background.md`, grepping the codebase for stub markers, running the full backend test suite, running `tsc --noEmit`, `expo export --platform web`, and `expo-doctor`. This file is a snapshot — `SKILLS.md` remains the source of truth for ongoing progress; this is the audit that checks `SKILLS.md`'s claims against what's actually true today.

## Headline

**The product is further along than "60%" suggests for the core loop, and the real gap is almost entirely Phase 9 (production launch readiness) plus mobile test coverage — not missing user-facing features.**

Phases 0 through 8.5, and Phase 10, are marked done in `SKILLS.md` and that holds up: habit CRUD, check-ins, streaks, cadence (daily/weekly/monthly + count-mode), goals, shared habits + group streaks, challenges, friend system with privacy-gated profiles, an AI coach ("Ask Habituate") grounded in real check-in data with confirm/reject proposals, home-screen widgets (Android + iOS), push reminders, dark mode, data export, onboarding tour, and notification swipe-actions + period-summary recaps. All verified present in code, not just claimed.

Phase 9 (production infrastructure) is the real unfinished 40%: no CI, no migrations tool, secrets in a config file, no rate limiting, no crash reporting, no DB index review, no real privacy policy page, store listing not started. One Phase 9 item — in-app account deletion — is done.

## Architecture as it actually is (not as SKILLS.md's history describes it)

**Important divergence from `SKILLS.md`'s own text:** Phases 4 and 6 describe a Kafka event backbone (`checkin-events` topic, `GroupStreakConsumer` as a `@KafkaListener`). **Kafka has since been removed entirely** (cost — was running ~$700/mo on Confluent Cloud pre-launch). This is intentional, already-corrected history — `SKILLS.md` is kept as a historical record per its own rule ("don't tidy old phases"), and `CLAUDE.md`/`docs/background.md`/`README.md` were rewritten to describe the current synchronous architecture. Don't let `SKILLS.md`'s Phase 4/6 text mislead you about current wiring.

**Current real write path:** Mobile → Spring Boot API → Postgres, in one `@Transactional` request. Group streak recompute (`GroupStreakUpdater`, renamed from `GroupStreakConsumer`) runs **synchronously in the same request**, not via any consumer/listener. No message broker anywhere in this stack.

**Backend:** Java 21 / Spring Boot 3.3.3, packaged by feature (`habits`, `checkins`, `goals`, `groups`, `coach`, `notifications`, `users`, `feedback`, `config`, `common`, `health`). No local `users` table backs most identity — Firebase Admin SDK is the source of truth for everyone except the narrow `users` row that exists only to cache timezone + a few profile fields scheduled jobs need outside an HTTP request.

**Mobile:** Expo SDK 57 / RN 0.86, New Architecture on. Five tabs (Today/Habits/Insights/Community/Profile), thin screens, one API client (`api/client.js`), per-feature hooks/providers. Full-page modals instead of a stack navigator for most secondary flows.

**Data model** matches `docs/background.md` — 16 tables, verified against actual entity classes during this audit, no drift found.

## Tests — ran them, here's what actually happened

- **Backend: 153/153 pass.** `./mvnw test` against the real local Postgres (`docker compose up`), zero failures, zero errors, zero skips. Clean.
- **Mobile: there is no mobile test suite.** Not a gap this audit found — `CLAUDE.md` says so explicitly ("There is no mobile test script and no lint script"). Worth stating plainly for Phase 3 planning: "fill test gaps" has zero existing mobile tests to build on, this is greenfield.
- **`npx expo export --platform web`: clean.** Bundles with no errors (62KB + 3.5MB JS, standard for this app).
- **`npx tsc --noEmit`: 8 errors, all in one file.** `mobile/widgets/HabitWidget.tsx` lines 61/68/75/82/106/116/131/142 — `theme.js`'s `lightColors.*` values are typed `string`, but `react-native-android-widget`'s RemoteViews components expect a branded `ColorProp` type. This directly confirms `SKILLS.md`'s own Phase 7 note that the widget code was "believed correct but unverified against a real compile" — it's now verified, and it doesn't compile clean. Likely still works at runtime (JS doesn't enforce the type), but it's a real, previously-unconfirmed defect, not a false alarm.
- **`npx expo-doctor`: 3 of 21 checks fail.** Detailed in Tech debt below.
- **EAS dev-client build:** confirmed working — a real Android development build (`f91b35ea…`) was built and installed successfully during this session, connected to Metro, and loaded the live bundle with the correct production API URL resolved. This is real-device verification, done earlier in this conversation, not assumed.

## Tech debt (ranked by risk)

1. **Missing peer dependency: `react-native-worklets`**, required by `react-native-reanimated`. `expo-doctor`'s own words: "Your app may crash outside of Expo Go without this dependency." This app's whole dev/test loop now runs on a real dev client (not Expo Go, per the widget work), so this is a live crash risk, not a theoretical one.
2. **`react-native-shared-group-preferences`** (iOS widget App Group bridge) is flagged by React Native Directory as **unmaintained** and **untested on New Architecture** — this app requires New Architecture (RN 0.86). It's also the package whose `android/build.gradle` called the long-dead `jcenter()` repo and broke Android builds outright until excluded from Android autolinking (fixed this session, commit `36411ae`). It still works for its actual job (iOS-only), but it's an unmaintained dependency with no tested New Architecture support sitting under a feature (widgets) the product leans on.
3. **`react-native-gesture-handler` is on a major version this Expo SDK doesn't expect** (3.3.0 installed vs. `~2.32.0` expected for SDK 57) — flagged by `expo-doctor` as a major mismatch, highest-severity version drift it reports.
4. **8 `tsc` errors in `HabitWidget.tsx`** (see Tests above) — a real, previously-unverified type-safety gap in the one TypeScript file in the mobile codebase.
5. **12 packages out of date** against the Expo SDK 57 pin set (`expo`, `expo-constants`, `expo-notifications`, `expo-sharing`, `expo-splash-screen`, `expo-updates`, `react-native-reanimated`, `react-native-safe-area-context`, `react-native-screens`, `react-native-svg`, etc.) — mostly patch/minor, one major (#3 above).
6. **No CI pipeline.** The 153-test backend suite and the mobile bundle check both only run when a human remembers to. Phase 9, unchecked.
7. **`ddl-auto=update`, no migration tool.** Fine for solo dev, not safe once this is a production database with real users. Phase 9, unchecked.
8. **Secrets in a config file path**, not a secret store. Phase 9, unchecked.
9. **No rate limiting on any public endpoint** — nothing stops hammering `/api/habits/{id}/check-ins`. Phase 9, unchecked.
10. **No crash reporting / error tracking**, mobile or backend. Phase 9, unchecked.
11. **No DB index review for scale** — `check_ins(habit_id, occurred_at)` / `check_ins(user_id, occurred_at)` indexes not confirmed present despite every streak/calendar query filtering on them. Phase 9, unchecked.
12. **Privacy policy URL is still a literal placeholder** (`PRIVACY_POLICY_URL` in `PrivacyScreen.js`) — a hard store-submission blocker, not polish. Phase 9, unchecked, has its own `// TODO` comment in the code (the only real `TODO` found anywhere in the codebase).
13. **No E2E/UI test tooling installed at all** (no Detox, no Maestro, no Playwright — and Playwright wouldn't apply here regardless, see note below).
14. **Dead code:** `mobile/screens/PlaceholderScreen.js` is fully built but no longer imported anywhere — every screen that used to need it has since shipped.
15. **Known, already-documented product gaps from `SKILLS.md` itself** (not new findings, but real and open): friend requests and group/challenge invites don't send any out-of-band notification (email/push) — the invitee only finds out by opening the app themselves, since no transactional email provider is wired up anywhere. Challenge invites specifically have no invite mechanism at all (private challenges are reachable only by direct id).
16. ~~Debug `System.out.println` in `UserProfileService`/`FriendProfileService`~~ — **already fixed this session** (commit `a9f7d04`), noting only so it's not re-flagged as new debt.

## On "verify in a browser" / Playwright (flagging again, now with the real picture)

This is a native mobile app. There is no web acceptance target (`CLAUDE.md` is explicit: "Expo web is a dev preview only, never the acceptance target"). The `expo export --platform web` bundle check above exists purely as a fast syntax/compile smoke test, not a UI verification surface — nothing about its output describes what a real screen looks like. Real verification happens on the EAS dev-client build on a real device/emulator, which this session has already done once successfully. Phase 3's plan will propose concrete alternatives for Phase 5's UI/interaction review (device screenshots at the real 360–430dp target widths, Detox or Maestro for e2e flows) in place of Playwright/browser-width screenshots.

## What this audit did NOT verify

- Did not click through the running app screen-by-screen on a device (that's Phase 5's job, not Phase 1's).
- Did not independently re-verify every `SKILLS.md` phase line-by-line against code — spot-checked architecture claims (Kafka removal, data model table count) and took the rest as accurate given the file's own detailed verification notes per item.
- Did not check Android Studio / Xcode native compile directly — relied on the EAS cloud build's successful Gradle run as the real signal (same build system used when a real native build is needed).
- Did not audit backend code for logic bugs/race conditions/edge cases — that's explicitly Phase 5's "bug hunter" lens, not Phase 1's.
