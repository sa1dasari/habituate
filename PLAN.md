# PLAN.md — Ranked task list for the remaining ~40%

Derived from `STATE.md` (audit) and `GAPS.md` (retention research). Ordered: finish incomplete features → retention mechanics → UI polish, per instruction. Within "incomplete features," cheap/high-risk items are sequenced before large infra projects — a crash-risk missing dependency shouldn't wait behind Terraform.

This is a plan, not yet approved. Phase 4 (build) does not start until you say go on this list — including the Phase 5 tooling substitution flagged below, which needs a decision before any review/test work is scoped.

---

## A. Finish incomplete features

**A1 — Quick, high-risk fixes (do first, cheap and currently live risk)**
1. Install missing peer dependency `react-native-worklets` (`npx expo install react-native-worklets`) — `expo-doctor`'s own words: "may crash outside of Expo Go," and this app now runs on a real dev client, not Expo Go.
2. Fix the 8 `tsc` errors in `mobile/widgets/HabitWidget.tsx` (`ColorProp` typing) — cast or retype the color values passed into `react-native-android-widget` components.
3. Remove dead code: `mobile/screens/PlaceholderScreen.js` (unused, no imports left).
4. Bump `react-native-gesture-handler` to the SDK-57-expected `~2.32.0` line, or confirm 3.3.0 is intentional and exclude it from `expo-doctor` checks explicitly (`expo.install.exclude` in `package.json`) rather than leaving it as an unexplained mismatch.
5. Run `npx expo install --check` for the other 11 outdated packages; apply the patch/minor bumps, re-run the backend+mobile verification steps after.

**A2 — Documented product gaps (real, user-facing, already known)**
6. Transactional email for friend requests / group invites / (eventually) challenge invites — currently silent, invitee only finds out by opening the app. Needs an email provider (SendGrid/SES) decision first.
7. `react-native-shared-group-preferences` replacement evaluation — unmaintained, untested on New Architecture, per `expo-doctor`. Not urgent (it works today, iOS-only), but worth a decision: accept the risk long-term, or scope a small custom Expo Module to replace it before it breaks on a future RN upgrade.

**A3 — Phase 9 production-readiness (the real "missing 40%")**
8. Privacy policy + Terms of Service: real hosted pages, linked from `PrivacyScreen.js` (currently a placeholder URL — hard store-submission blocker).
9. CI pipeline (GitHub Actions): backend `./mvnw test` on every PR, mobile bundle/tsc check at minimum.
10. Replace `ddl-auto=update` with Flyway or Liquibase migrations.
11. Secrets management: move the Firebase service-account key and API keys out of a filesystem-path config into a real secret store.
12. DB index review: confirm/add indexes on `check_ins(habit_id, occurred_at)` and `check_ins(user_id, occurred_at)`.
13. API rate limiting on public endpoints, starting with `/api/habits/{id}/check-ins`.
14. Crash reporting + error tracking (Sentry or similar on mobile; structured logs/APM on backend).
15. Environment separation: distinct Firebase projects + Postgres DBs for dev/staging/prod.
16. Terraform for the already-decided AWS footprint (ECS Fargate, RDS) — actually provisioned.
17. Mobile release pipeline: EAS Build + Submit configured for both stores, versioning scheme, EAS Update wired for JS-only hotfixes.
18. Store listing compliance: screenshots, descriptions, Play Store Data Safety form, Apple App Privacy details.
19. Load/smoke test the check-in write path at a realistic concurrent-user estimate.

Item 19 needs 9–18 substantially done first to be meaningful; it's listed last within this group for that reason, not because it's low-priority.

---

## B. Retention mechanics (from `GAPS.md`, each already cross-checked against what's built)

20. **Personal streak freeze** — schema already supports it (`user_id` nullable on `streak_freezes`), group-side implementation already exists as a direct template. Cheapest item in this section. *(Duolingo)*
21. **Pre-permission push explainer screen**, shown once before the OS prompt. *(Duolingo)*
22. **Streak repair** — a non-punitive way to recover a recently-broken personal streak (e.g., one free repair/month), framed as "pick back up," not "redeem yourself." *(Duolingo)*
23. **Reminder copy audit** — confirm `ReminderScheduler`'s actual notification text references what the habit is *for*, not just that it's due. *(Duolingo)*
24. **Optional identity/"why" field** on habit creation, feeding `CoachContextBuilder` so Ask Habituate can ground answers in a stated motivation. *(Atoms)*
25. **Onboarding speed audit** — measure time-to-first-logged-check-in through the current 15-step tour; if slow, add a "skip tour, just add your first habit" fast path. *(Atoms)*
26. **Empty-state audit** — confirm every first-use empty state (Habits/Insights/Community on a fresh account) has one specific CTA, not just non-punitive copy. *(general UX research)*

---

## C. UI polish

Deliberately left unranked in detail here — this is Phase 5's job (UI reviewer + interaction reviewer lenses), not something to pre-plan blind. Phase 3 just confirms it comes last.

---

## Flagging before this plan can really start: Phase 5 tooling

Your original instructions describe Phase 5 in web-app terms: Playwright e2e tests, "screenshot every screen at mobile and desktop widths," "verify in a real browser." This app has no web/desktop acceptance target (`CLAUDE.md` is explicit: Expo web is dev-preview only). Proposed substitution, needs your approval before Phase 5 is scoped:

- **E2E tests:** Maestro (YAML-based, simplest to set up for Expo/EAS) or Detox (deeper RN integration, heavier setup) in place of Playwright. Neither is installed yet — this is itself new tooling, which the Phase 4 "don't introduce new libraries without asking" rule covers; flagging now rather than silently picking one at Phase 5 time.
- **Visual review:** screenshots from a real EAS dev-client build on a device/emulator at the actual target widths this app designs for (360–430dp, per `CLAUDE.md`), not browser viewport widths.
- **"Verify in a real browser":** read as "verify on a real device/emulator" throughout — the spirit of the rule (don't claim something works without testing it) stays, the mechanism changes to match what this app actually is.

---

## Summary of what's NOT in this list

Backlog items (`Habituate Wrapped`, photo/OCR import, wearable integration, broader social/discovery features) are intentionally excluded — `SKILLS.md` already marks them "do not pull forward without a specific reason," and nothing in this audit or research surfaced one.
