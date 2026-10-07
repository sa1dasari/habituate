# CLAUDE.md — Habituate build context

This file is the standing context for any AI assistant (Copilot, Claude, etc.) working on this repo. Read this before generating code. It describes what the app is, why decisions were made, the current architecture, and the conventions to follow. Keep this file updated as decisions change — it should always reflect the real state of the project, not the original plan.

Global design rule (applies to all phases):
- Design-first, mobile-first: the /design assets are the canonical UI spec for every phase. Implementations must prioritize native mobile device layouts, use mobile-optimized component sizes and touch targets, and match design tokens for colors, spacing, and typography. The Expo web preview is permitted for development convenience but is not the acceptance target.

## Deployment target

The end goal is a real Play Store + App Store release, not just a personal/dev build. This should shape decisions as they come up, not just be a final checklist:
- Prefer Expo Go–compatible / EAS Build–compatible libraries. A native module that forces `expo prebuild` (ejecting from the managed workflow) is a real cost — worth it only when there's no managed-workflow alternative, not a default choice.
- Apple requires in-app account deletion (not just sign-out) for any app with account creation — build this before submission, not as an afterthought.
- A privacy policy is required by both stores once Firebase Auth / any user data collection is live — needed before the first submission, not after.
- Firebase config, API keys, and the backend's production deployment (Terraform/AWS, per below) need to be real and stable before store review — reviewers test the actual live app, not a mocked build.
- Anti-guilt UX and the non-causal correlation framing (see below) aren't just product taste — health/wellness-adjacent app review can flag manipulative or unsubstantiated-claim patterns, so these conventions are also a review-risk mitigation.

## What this app is

Habituate is a habit-tracking app with three differentiators over generic trackers:
1. **An AI habit coach ("Ask Habituate")** that answers questions grounded in your real check-in data and can propose (never auto-apply) concrete adjustments — replaces the former real-time correlation/pattern-detection engine, hard-deleted 2026-10-04 (see the data model note on `correlations`/`insights` below and SKILLS.md Phase 10). **Shipped 2026-10-06**: a persistent per-user chat (`com.habituate.api.coach`, Anthropic's Messages API called server-side) grounded in computed per-habit completion stats, with a Confirm/Reject "suggested adjustment" card that only ever mutates a habit's target on explicit confirm.
2. Shared/group habits with Snapchat-style streaks.
3. Anti-guilt UX — no punitive red X's, streak freezes, trend framing.

Do not add features outside the scope defined in `SKILLS.md` without updating that file first. Scope creep is the main risk on a solo build with this much backend complexity.

Competitive note: habit-tracker-with-friends apps (HabitShare, Habit Huddle, Done, HabitHook) exist, and so do AI-coaching-style wellness apps — Habituate's differentiation is the *combination*: an AI coach grounded in real check-in data (not a generic chatbot with no data access) alongside an explicit per-group streak rule and a Wrapped-style recap as a distribution mechanic.

## Tech stack and why

- **Mobile: React Native (Expo).** Single codebase for iOS/Android, fastest path to both platforms for a solo builder.
- **Backend: Spring Boot (Java).** Primary language of the developer; also the natural home for the correlation engine's orchestration logic.
- **Postgres.** Relational source of truth for users, habits, check-ins, goals, groups.
- **Kafka.** Event backbone. Every check-in is published as an event, not just written to Postgres. This is what makes the insights engine real-time instead of a nightly batch job.
- **Flink.** Stateful stream processing for the correlation engine. Keeps a rolling per-user, per-habit window of completion data and recomputes correlation when that state changes meaningfully.
- **Firebase Auth + FCM.** Don't roll custom auth or push infra for a solo project. Verify the Firebase ID token server-side on every API request — never trust a client-supplied user ID.
- **Terraform + AWS (ECS Fargate, RDS, MSK).** Fargate over EKS/K8s — simpler ops for a single maintainer. Revisit only if there's a specific reason to need K8s.

## Architecture

### Write path
Mobile app → Spring Boot API → writes to Postgres (source of truth) AND publishes to Kafka topic `checkin-events`, in the same request. Postgres write and Kafka publish must not drift — if one fails, the request fails (use a transactional outbox pattern if this becomes a reliability issue).

### Insight path — replaced by Ask Habituate, 2026-10-06
This section used to describe a Kafka → Flink → correlation-store pipeline (Phase 6, never built) behind the Phase 5 batch correlation engine that *was* built, shipped, then hard-deleted 2026-10-04 once real usage showed the "Pattern detected" cards weren't useful (see the `correlations`/`insights` data-model note). No stream-processing insight pipeline exists in this codebase, and SKILLS.md Phase 10 decided against building one: instead, `com.habituate.api.coach` computes per-habit completion stats synchronously, on-request, straight from `check_ins` (`CoachContextBuilder` — current/longest streak via `StreakCalculator`, days-active over the last 7/30 days), and hands those stats to Anthropic's Messages API (`AnthropicClient`, called server-side so the API key never reaches the mobile client) as grounding context. No Kafka consumer, no rolling window state, no nightly job — a chat request is the trigger, not an event stream. `coach_messages` persists one continuous thread per user (see the data model note below); a message optionally carries a proposed habit-target adjustment or a proposed new-habit creation that's only ever applied on explicit user confirm (`CoachService.confirmProposal`), never automatically.

**One rule carries forward regardless of architecture:** any AI-coach response must stay non-causal and grounded in the user's real data — never "X causes Y" or "X helps you do Y," only language like "you complete Y on X% of the days you complete X" or the design mockup's own hedged phrasing ("could make... more manageable"). This was the correlation engine's framing rule and is now enforced via `CoachPrompts`' system prompt, sent on every request.

### Groups / social
Group check-ins and activity feeds reuse the same Kafka `checkin-events` stream — a group is just a filtered consumer of the same events, not a separate pipeline. Don't build a parallel system for this.

**Shared Habits are distinct from Challenges** in both data model and UI. A Shared Habit is a single habit tracked jointly by 2+ people with its own persistent group streak and an explicit streak rule (all members must check in / any member checking in keeps it alive). A Challenge is a time-boxed, multi-person goal with a progress bar, not a running streak. Don't merge these into one feed or one table — they behave differently and the finalized Community screen presents them as separate sections.

### Wrapped / recap
Reads from the existing insights store and check-in history. No new pipeline — this is a presentation/templating layer on data that already exists.

## Data model

- `users` — id, email, auth_provider, timezone, created_at
- `habits` — id, user_id, name, category, cadence_type (daily / weekly / monthly), cadence_target, weekly_target (nullable), monthly_target (nullable), tracking_mode (boolean / count), color, scheduled_time, reminder_enabled, archived_at
  - `cadence_target` / `weekly_target` / `monthly_target` are independent, not mutually exclusive — a habit can carry any combination (e.g. gym: `weekly_target=2`, `monthly_target=12`, no daily target). `cadence_type` no longer picks which one applies; it's effectively vestigial now that a habit can span scales at once.
  - `tracking_mode`: `boolean` (default) is one check-in a day, toggled on/off. `count` allows any number of check-ins a day, each carrying a `value`; period totals sum those values instead of counting distinct days — required for a target like "50 applications this month," which is otherwise unreachable if every check-in dedupes to at most one day.
- `check_ins` — id, habit_id, user_id, occurred_at, value, source (manual / ocr_import), group_id (nullable)
  - `value` defaults to 1 (a boolean check-in) but for `count` habits carries the logged quantity (e.g. `value=5` for a batch of 5 applications logged at once). Multiple check-ins per habit per day are allowed — necessary for `count` habits, harmless for `boolean` ones since the UI only ever creates one per day for those.
- `goals` — id, user_id, period (week/month), habit_id (nullable), target_count, description
- ~~`correlations`, `insights`~~ — **hard-deleted 2026-10-04** along with `com.habituate.api.insights` (`CorrelationEngine`, `InsightService`, the nightly scheduler, `/api/insights/*`) and all pattern-detection UI — see SKILLS.md Phase 10. Dropped directly from the dev database rather than left as dead tables, per this codebase's own "don't leave half-finished/unused implementations around" convention.
- `coach_messages` — id, user_id, role (USER/ASSISTANT), content, habit_id (nullable), proposal_type (nullable: ADJUST_HABIT/CREATE_HABIT), proposal_payload (nullable, JSON — CREATE_HABIT's name/category/cadenceTarget/weeklyTarget/monthlyTarget/trackingMode), adjustment_field (nullable: cadenceTarget/weeklyTarget/monthlyTarget — ADJUST_HABIT only), adjustment_current_value (nullable), adjustment_new_value (nullable), adjustment_title (nullable), adjustment_description (nullable), adjustment_status (nullable: PENDING/CONFIRMED/REJECTED), created_at
  - Ask Habituate's persisted thread (SKILLS.md Phase 10) — one continuous conversation per user, not multiple named threads, matching the design's single ongoing chat. A message carries AT MOST ONE proposed action, discriminated by `proposal_type` — adding habit creation (2026-10-06, beyond the original Phase 10 plan, per explicit user request) reused the existing `adjustment_title`/`adjustment_description`/`adjustment_status` columns as shared card copy + lifecycle state for BOTH proposal types (despite the name) rather than a column rename migration, and gave CREATE_HABIT's different field set its own `proposal_payload` JSON column rather than a pile of columns that are null on every ADJUST_HABIT row. `habit_id` doubles as the grounding citation target (`CoachMessageResponse.groundingLabel`, e.g. "Your check-ins · Morning Walk · Last 7 days", ADJUST_HABIT only) and — for CREATE_HABIT, set only once confirmed — the newly created habit. `adjustment_status` starts `PENDING` and is the only thing `CoachService.confirmProposal`/`rejectProposal` ever flips; the habit itself is created or mutated in that same call (confirmProposal branches on `proposal_type`, calling the existing `HabitService.createHabit` for CREATE_HABIT rather than duplicating its validation), never inside the chat-reply path.
- `friendships` — id, requester_id, recipient_id, status (PENDING/ACCEPTED/DECLINED), created_at, updated_at
  - directional (requester → recipient), not mirrored into a reciprocal row on accept — "my friends" queries check both sides with status = ACCEPTED, same spirit as correlations being stored directionally rather than duplicated. No local `users` table exists (userId is a raw Firebase UID everywhere) — invites resolve email → UID via the Firebase Admin SDK directly (`UserLookupService`/`FirebaseUserLookupService` in the `groups` package), not a local lookup.
- `groups` — id, name, created_by, streak_rule (ALL_MEMBERS / ANY_MEMBER), created_at
  - no `habit_id` on this table (deviates from the original plan) — see `group_members` below for why
- `group_members` — id, group_id, user_id, habit_id (nullable), status (PENDING/ACTIVE), joined_at
  - `habit_id` is an addition beyond the original plan: a Shared Habit is NOT one literal habit row multiple people write to — `habits.user_id` is a single owner everywhere else in this codebase, and loosening that would mean rewriting ownership checks throughout. Instead, each member keeps their own personal habit (their own row, their own private streak/history, tracked exactly as a solo habit), and this column just links *that member's own* habit to the group. A normal check-in through the existing `createCheckIn` endpoint gets tagged with `check_ins.group_id` automatically when its habit is group-linked (one lookup in `HabitService`) — no separate "group check-in" path.
- `group_streaks` — group_id (also the primary key — one row per group, upserted in place), current_streak, longest_streak, last_qualifying_date, status (active / at_risk / frozen), updated_at
  - `status` drives the visual state on the Shared Habits card — `at_risk` when the streak's qualifying window is still open today but not yet satisfied, `frozen` when a grace token has been applied. Recomputed by `groups.GroupStreakConsumer`, a `@KafkaListener` on the same `checkin-events` topic (its own consumer `groupId`, `habituate-api-group-streak-consumer` — distinct from the existing logger's, or the two would compete for partitions instead of each independently seeing every event) filtered to events whose check-in is group-linked — per the groups/social architecture note, this is "just a filtered consumer of the same events," not a separate pipeline. Bucketed in UTC, same caveat as the insights engine.
- `streak_freezes` — id, user_id (nullable), group_id (nullable), used_on_date, source (personal_grace / group_grace)
  - v1 only implements the group_grace path: `groups.StreakFreezeScheduler` runs daily just after UTC midnight, auto-applying a freeze (no user action needed) to any group whose streak broke yesterday, if one hasn't been used in the last 30 days — otherwise the streak resets. Personal habit streak freezes are a deliberate, documented deferral (see SKILLS.md Phase 7) — personal streak-pressure mechanics don't exist yet to need freezing.
- `challenges` — id, name, description, created_by, target_count, period_start, period_end, visibility (PUBLIC / PRIVATE, default PRIVATE), created_at
  - time-boxed and multi-person, deliberately separate from Shared Habits in both data model and UI (per the groups/social architecture note) — a progress bar against `target_count`, not a running streak, and it carries no `habit_id` at all. `period_end - period_start` is capped at 365 days (`ChallengeService.MAX_PERIOD_DAYS`) — any range from 1 day to 1 year, not fixed presets.
  - **Visibility is the opposite of Shared Habits on purpose:** Shared Habits stay private-only (friendship-gated invites, no discovery surface). Challenges can be `PUBLIC` (shows up in `GET /api/challenges/browse`, anyone can join) or `PRIVATE` (default — hidden from browse). There's no challenge-invite system yet, so a `PRIVATE` challenge is only reachable by whoever already knows its id and calls join directly; it's "not discoverable," not "access-controlled."
- `challenge_check_ins` — id, challenge_id, user_id, occurred_at
  - Boolean-only, one row per day a participant logs (no counter/count-mode, unlike habits) — mirrors a BOOLEAN habit's check-in shape rather than reusing `check_ins`, since a Challenge carries no `habit_id` to hang it off. `myProgress` in `ChallengeResponse` is `COUNT(*)` for that (challenge, user) pair, not a stored running total, which is what makes "unlog today" possible — `DELETE /api/challenges/{id}/check-ins/today` removes the matching row the same way a habit's `deleteCheckIn` does. `POST /api/challenges/{id}/check-ins` enforces one log per local day (same `X-Timezone`-bucketed duplicate guard as `HabitService.createCheckIn`), throwing the same `DuplicateCheckInException`. This superseded the original `challenge_participants.progress_count` column (dropped) — each participant's own progress is derived, not stored, mirroring how `StreakCalculator` derives streaks from `check_ins` rather than storing a running count.
- `challenge_participants` — id, challenge_id, user_id, joined_at
  - pure membership row now (no `progress_count` — see `challenge_check_ins` above); `ChallengeService.logCheckIn`/`unlogCheckIn` require having joined first (`ForbiddenException` otherwise). `ChallengeResponse` shows the *viewing* user's own progress alongside the full roster — CLAUDE.md's "a progress bar" didn't specify whose, so this is a documented product decision, not a literal spec reading.
- `users` — id (Firebase UID), timezone (nullable), date_of_birth (nullable), updated_at
  - **The first local record in this codebase keyed by Firebase UID** — every other feature (friendships, groups, challenges) deliberately resolves identity through the Firebase Admin SDK directly rather than a local table (see the `friendships` note above). This table originally existed for one narrow reason: `ReminderScheduler` is a background job with no HTTP request to read the `X-Timezone` header from, so a user's timezone has to be persisted somewhere before a scheduled reminder can fire at the right local hour — `timezone` is still only ever populated opportunistically by `FirebaseAuthFilter` off the `X-Timezone` header, no dedicated "set my timezone" endpoint. `date_of_birth` is the first user-facing field on this table: Firebase Auth has no concept of it, so `UserProfileController` (`GET`/`PATCH /api/users/me`) owns it directly — `UserProfileService` validates it's not in the future and not implausibly old (>130 years). Reusable later for the UTC-bucketing caveats already noted on the insights engine and group streaks, if that's ever worth revisiting.
  - **Profile picture and display name are deliberately not stored here** — they're Firebase Auth's own `photoURL`/`displayName` fields (set via `updateProfile()` client-side), edited from the same `EditProfileModal`. The photo itself lives in **Firebase Storage** (`profile-photos/{uid}.jpg`), not this table or any backend endpoint — the mobile app uploads directly via the Firebase Storage JS SDK and only the resulting download URL gets written to `photoURL`. **Setup gap, not a code issue:** this requires the Storage bucket to actually be enabled with appropriate security rules in the Firebase console (e.g. a user may write only to their own `profile-photos/{uid}.jpg` path) — a brand-new Firebase project's Storage bucket is not usable until that's done manually.
- `push_tokens` — id, user_id, token (unique), platform, created_at, updated_at
  - Stores an **Expo push token**, not a raw FCM/APNs device token — `ReminderScheduler`/`ExpoPushService` send through Expo's push relay (`https://exp.host/--/api/v2/push/send`) rather than calling Firebase Cloud Messaging directly, which is what lets the mobile app receive reminders from inside Expo Go on iOS without a development build. Upserted by `token`, not by `(user_id, token)` — the same device's token can legitimately move to a different account (sign out, sign in as someone else on a shared phone). A token that comes back `DeviceNotRegistered` in a push response is deleted; full delivery-receipt polling (Expo's two-step ticket→receipt flow, which also catches a since-uninstalled app) is a documented v1 simplification, not implemented.
  - **Known platform gap:** Expo Go on Android has not supported remote push since SDK 53 — testing reminders on Android needs a one-time EAS development-client build (still the managed workflow + EAS Build, not a full eject to bare — a smaller ask than a native-module feature like a home-screen widget). iOS works directly in Expo Go. Separately, no EAS project is linked yet (`app.json` has no `extra.eas.projectId`), so `getExpoPushTokenAsync` can't mint a real token on a device until `eas init` runs — unrelated to any code here.
- `check_in_cheers` — id, check_in_id, user_id, created_at, unique (check_in_id, user_id)
  - Backs the Profile page's "Shared progress" feed (`GroupActivityService`/`GroupActivityController`, `/api/groups/activity`) — closes the Phase 7 "friend activity feed" deferral. Deliberately **not** a generic feed of everything a friend tracks: it's scoped to check-ins that already carry a `groupId` (i.e. already visible to fellow members of that shared habit, per the groups/social architecture note), filtered to groups the *viewing* user is also an active member of — a friend you aren't in any shared habit with never leaks their activity to you just from the friendship. A cheer is toggled on/off per (check-in, user), not a count a single user can rack up; `GroupActivityService.cheer`/`uncheer` re-derive group membership from the check-in's own `groupId` rather than trusting the caller, so cheering an arbitrary check-in id throws `ForbiddenException`.

## UI conventions

These reflect the finalized Insights and Community screen designs — build to match, don't reinterpret.

### Insights screen
Pattern-detection cards (directional label, match %, nudge) are **removed as of 2026-10-04** — real usage showed they weren't useful, replaced 2026-10-06 by SKILLS.md Phase 10:
- Consistency ring for the selected period (Daily/Weekly/Monthly/Yearly tabs), with a trend delta badge (e.g. "+12%") — tapping the card opens `ConsistencyDetailModal` (`design/Consistency detail.png`): a horizontal habit picker, a bar graph of period-bucketed history for the selected habit (Samsung-Health-style), and a plain-language summary below it
- An "Ask Habituate" entry card (`design/Insights.png`) with 3 suggested starter questions, opening `AskHabituateModal` (`design/Ask Habituate.png`) — the AI coach chat, see "Insight path" above

### Community screen
- "Shared Habits" section is first and separate from "Challenges" — do not combine them
- Each Shared Habit card shows: habit name, participants, time, the streak rule (e.g. "All members"), current group streak length, and a status-driven visual (safe / at-risk / frozen) — the frozen state should read as a distinct icon treatment (e.g. a frost/shield mark), not just a broken streak with an asterisk
- "Challenges" section below shows progress-bar-style, time-boxed goals with participant avatars — no streak mechanics here

### General
- No red X for missed days, anywhere in the app
- Trend framing over perfection framing in all copy
- Streak-freeze state must always have its own visual treatment before streak-pressure mechanics ship

## Conventions

### Backend (Spring Boot)
- Package by feature, not by layer (`habits/`, `checkins/`, `insights/`, `groups/`), each with its own controller/service/repository.
- REST, not GraphQL, for v1 — keep the surface simple while the app is still one developer.
- Every write that should trigger a Kafka event does so inside the service layer, not the controller.
- DTOs at the API boundary; never expose JPA entities directly.

### Mobile (React Native / Expo)
- Functional components, hooks only, no class components.
- Mobile-first: implement for phone viewports as the primary target. Use the design assets in /design as the canonical visual spec — Expo web is allowed only for development preview, not for final visual acceptance.
- Component sizing, spacing, and touch targets must be optimized for mobile (target widths 360–430dp, minimum touch target 44px/44dp, readable type sizes for mobile). Avoid desktop-first layouts.
- API calls centralized in a single client module, not scattered `fetch` calls.
- Keep screen components thin; business logic in hooks or a shared state layer.
- Aim for pixel/spacing fidelity with the design files: colors, icons, typography, and token sizes should be matched or documented if deviating.

### Mobile visual system — font, effects, dark mode (do not regress)

These three things were deliberately built together and any new mobile code must follow them, not bypass them:

- **Font.** Nunito (via `@expo-google-fonts/nunito`, loaded in `App.js`'s `useFonts` call) is the app's typeface. Never write `fontWeight` alone on a text style that's meant to look like a heading/label/body — use the `fonts.*` keys (`regular`/`semiBold`/`bold`/`extraBold`) or the `typography.*` presets (`screenTitle`/`sectionTitle`/`cardTitle`/`body`/`label`/`meta`) from `theme.js`. Setting `fontWeight` alongside a Nunito `fontFamily` can make Android silently drop the custom font in favor of a fake-bolded system font — set one or the other, never both.
- **Visual effects.** Progress bars and rings use the gradient tokens in `theme.js` (`gradients.accent/safe/warm`) via `expo-linear-gradient` (flat bars) or an SVG `<LinearGradient>` (rings/icons) — don't revert them to flat `backgroundColor`. Hero cards (Today's summary, the check-in celebration) use `shadowLg`, not `shadow`, to stay visually distinct from ordinary cards. The one flame glyph is `components/FlameIcon.js` (gradient scales with streak length via `flameStopsForStreak`) — never reach for a plain `MaterialCommunityIcons name="fire"` instead, that regresses back to the inconsistent icon set this replaced.
- **Dark mode.** `theme.js` exports `lightColors`/`darkColors` plus `buildTypography()`/`buildStreakStates()` (functions of a palette, not fixed values) — `hooks/useAppTheme.js`'s `ThemeProvider`/`useAppTheme()` resolves the active one (persisted, with a "system" option that follows the OS). **Every component that needs colors or typography must call `useAppTheme()` and build its `StyleSheet.create()` inside a `useMemo(() => makeStyles(colors, typography), [colors, typography])`**, not at module scope. `StyleSheet.create()` runs once at import time, so a style object built from a static `colors` import freezes at whatever the palette was when the app loaded — that's the bug this pattern exists to prevent. Never import `colors`/`typography`/`streakStates`/`resolveStreakState` directly from `theme.js` in a component (the plain exports are a fallback for non-component code only); always go through the hook. `spacing`, `radii`, `shadow`, `shadowLg`, `fonts`, and `gradients` are palette-independent and *can* stay as plain static imports.

### General
- No feature ships without updating `SKILLS.md`'s checklist for that phase.
- Anti-guilt UX rules are non-negotiable in any check-in or streak UI: no red X for missed days, no shaming copy, streak freezes must exist before streak pressure mechanics ship.
- When in doubt about scope, prefer shipping the current phase in `SKILLS.md` over adding a new capability.

## Current phase

See `SKILLS.md` for the active phase and what's done vs. pending. Update that file, not this one, as phases complete.
