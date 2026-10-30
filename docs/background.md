# Background — Habituate

Long-form rationale and the full data model, moved out of `CLAUDE.md` to keep that file short and current. This is history and "why," not a live checklist — see `SKILLS.md` for what's actually done.

## What this app is

Habituate is a habit-tracking app with three differentiators over generic trackers:
1. **An AI habit coach ("Ask Habituate")** that answers questions grounded in your real check-in data and can propose (never auto-apply) concrete adjustments — replaces the former real-time correlation/pattern-detection engine, hard-deleted 2026-10-04 (see the data model note on `correlations`/`insights` below and SKILLS.md Phase 8). Shipped 2026-10-06: a persistent per-user chat (`com.habituate.api.coach`, Anthropic's Messages API called server-side) grounded in computed per-habit completion stats, with a Confirm/Reject "suggested adjustment" card that only ever mutates a habit's target on explicit confirm. Phase 10 (2026-10-28) added bidirectional emoji reactions on top of this.
2. Shared/group habits with Snapchat-style streaks.
3. Anti-guilt UX — no punitive red X's, streak freezes, trend framing.

Competitive note: habit-tracker-with-friends apps (HabitShare, Habit Huddle, Done, HabitHook) exist, and so do AI-coaching-style wellness apps — Habituate's differentiation is the *combination*: an AI coach grounded in real check-in data (not a generic chatbot with no data access) alongside an explicit per-group streak rule.

## Tech stack and why

- **Mobile: React Native (Expo).** Single codebase for iOS/Android, fastest path to both platforms for a solo builder.
- **Backend: Spring Boot (Java).** Primary language of the developer; the natural home for every piece of backend business logic, including Ask Habituate's AI-coach orchestration.
- **Postgres.** Relational source of truth for users, habits, check-ins, goals, groups.
- **Kafka.** Event backbone. Every check-in is published as an event, not just written to Postgres — group streaks and the friend-activity feed are both filtered consumers of this same stream, not separate pipelines.
- **Firebase Auth + FCM-via-Expo.** Don't roll custom auth or push infra for a solo project. Verify the Firebase ID token server-side on every API request — never trust a client-supplied user ID.
  - **Multi-provider account linking (email/password, Google, Facebook, Apple) is handled entirely client-side via Firebase Auth's own `linkWithCredential`/`unlink`** (`mobile/hooks/useAuth.js`) — the backend requires zero per-provider awareness, since `FirebaseAuthFilter.verifyIdToken` only validates a standard Firebase-issued JWT and never inspects which provider signed it. A user stays on the same Firebase UID (and therefore the same rows in every UID-keyed table) no matter which linked provider they sign in with next. The one case deliberately NOT auto-handled: a fresh sign-in on provider B when an account with that email already exists via provider A throws Firebase's `auth/account-exists-with-different-credential` — rather than attempting fragile automatic credential merging, the app surfaces which provider the account already uses and asks the user to sign in with that one first, then link the new one from Account Settings → Login & Security.
- **Terraform + AWS (ECS Fargate, RDS, MSK) — planned, not yet provisioned.** Fargate over EKS/K8s — simpler ops for a single maintainer. Revisit only if there's a specific reason to need K8s. Currently actually hosted on Railway (see CLAUDE.md §2).

## Architecture notes

### Insight path — replaced by Ask Habituate, 2026-10-06
This used to describe a real-time stream-processing pipeline behind the Phase 5 batch correlation engine that *was* built, shipped, then hard-deleted 2026-10-04 once real usage showed the "Pattern detected" cards weren't useful. No stream-processing insight pipeline exists in this codebase, and SKILLS.md Phase 8 decided against building one: instead, `com.habituate.api.coach` computes per-habit completion stats synchronously, on-request, straight from `check_ins` (`CoachContextBuilder` — current/longest streak via `StreakCalculator`, days-active over the last 7/30 days), and hands those stats to Anthropic's Messages API (`AnthropicClient`) as grounding context. No Kafka consumer, no rolling window state, no nightly job — a chat request is the trigger, not an event stream.

### Groups / social
Group check-ins and activity feeds reuse the same Kafka `checkin-events` stream — a group is just a filtered consumer of the same events, not a separate pipeline.

**Shared Habits are distinct from Challenges** in both data model and UI. A Shared Habit is a single habit tracked jointly by 2+ people with its own persistent group streak and an explicit streak rule (all members must check in / any member checking in keeps it alive). A Challenge is a time-boxed, multi-person goal with a progress bar, not a running streak.

## Data model

- `users` — id (Firebase UID), timezone (nullable), date_of_birth, phone_number, address, gender (free text, no fixed taxonomy), username, profile_visibility (PUBLIC/PRIVATE, default PRIVATE), updated_at. The first local record keyed by Firebase UID — every other feature resolves identity through the Firebase Admin SDK directly rather than a local table. Profile picture and display name are Firebase Auth's own `photoURL`/`displayName` fields, not stored here — the photo lives in Firebase Storage (`profile-photos/{uid}.jpg`), uploaded directly by the mobile client.
- `habits` — id, user_id, name, category, cadence_type (daily/weekly/monthly — now effectively vestigial), cadence_target, weekly_target (nullable), monthly_target (nullable, independent of each other, a habit can span scales at once), tracking_mode (boolean/count), color, scheduled_time, reminder_enabled, archived_at.
- `check_ins` — id, habit_id, user_id, occurred_at, value (defaults 1, carries logged quantity for count habits), source (manual/ocr_import), group_id (nullable, auto-tagged when the habit is group-linked).
- `goals` — id, user_id, period (week/month), habit_id (nullable), target_count, description.
- ~~`correlations`, `insights`~~ — **hard-deleted 2026-10-04** along with `com.habituate.api.insights` and all pattern-detection UI. Dropped directly from the dev database rather than left as dead tables.
- `coach_messages` — id, user_id, role (USER/ASSISTANT), content, habit_id (nullable, doubles as grounding citation or newly-created-habit reference), proposal_type (nullable: ADJUST_HABIT/CREATE_HABIT), proposal_payload (JSON, CREATE_HABIT only), adjustment_field/current_value/new_value/title/description/status (ADJUST_HABIT fields, also reused as shared card copy for CREATE_HABIT), user_reaction (nullable emoji, either role), ai_reaction (nullable emoji, USER rows only, server-computed heuristic — no extra Anthropic call), created_at. One continuous thread per user, not multiple named threads.
- `friendships` — id, requester_id, recipient_id, status (PENDING/ACCEPTED/DECLINED), created_at, updated_at. Directional, not mirrored into a reciprocal row on accept — "my friends" queries check both sides with status = ACCEPTED.
- `groups` — id, name, created_by, streak_rule (ALL_MEMBERS/ANY_MEMBER), created_at. No `habit_id` on this table — see `group_members`.
- `group_members` — id, group_id, user_id, habit_id (nullable), status (PENDING/ACTIVE), joined_at. A Shared Habit is NOT one literal habit row multiple people write to — `habits.user_id` is a single owner everywhere else, and loosening that would mean rewriting ownership checks throughout. Instead each member keeps their own personal habit, and this column links *that member's own* habit to the group.
- `group_streaks` — group_id (PK, one row per group, upserted in place), current_streak, longest_streak, last_qualifying_date, status (active/at_risk/frozen), updated_at. Recomputed by `groups.GroupStreakConsumer`, a `@KafkaListener` on `checkin-events` (its own consumer group) filtered to group-linked check-ins. Bucketed in UTC.
- `streak_freezes` — id, user_id (nullable), group_id (nullable), used_on_date, source (personal_grace/group_grace). v1 only implements group_grace: `groups.StreakFreezeScheduler` runs daily just after UTC midnight, auto-applying a freeze to any group whose streak broke yesterday if one hasn't been used in the last 30 days. Personal habit streak freezes are a deliberate, documented deferral.
- `challenges` — id, name, description, created_by, target_count, period_start, period_end (capped at 365 days from start), visibility (PUBLIC/PRIVATE, default PRIVATE), created_at. **Visibility is the opposite of Shared Habits on purpose**: Shared Habits stay private-only (friendship-gated invites, no discovery surface); Challenges can be PUBLIC (shows up in `GET /api/challenges/browse`) or PRIVATE (hidden from browse, reachable only by id).
- `challenge_check_ins` — id, challenge_id, user_id, occurred_at. Boolean-only, mirrors a BOOLEAN habit's check-in shape. `myProgress` is `COUNT(*)`, not a stored running total — superseded the original `challenge_participants.progress_count` column (dropped).
- `challenge_participants` — id, challenge_id, user_id, joined_at. Pure membership row now.
- `push_tokens` — id, user_id, token (unique, upserted by token not by user+token — a device's token can legitimately move accounts), platform, created_at, updated_at. Stores an **Expo push token**, not a raw FCM/APNs token — sent through Expo's push relay rather than calling FCM directly, which is what lets reminders reach a device from inside Expo Go on iOS. Expo Go on Android has not supported remote push since SDK 53; Android needs a dev-client build.
- `check_in_cheers` — id, check_in_id, user_id, created_at, unique(check_in_id, user_id). Backs the Profile page's "Shared progress" feed, scoped to check-ins that already carry a `group_id` and filtered to groups the *viewing* user is also an active member of — a friend you aren't in any shared habit with never leaks their activity to you just from the friendship.
- `feedback` — id, user_id, type (BUG/SUGGESTION), page, message, steps_to_reproduce, app_version, platform, created_at, plus `feedback_attachments` (feedback_id, url). Write-only from the app's perspective — no in-app list of past submissions, no admin UI; every submission triggers a best-effort email to the maintainer instead. Attachments upload directly from the mobile client to Firebase Storage, bypassing the backend.
- `app_notifications` — id, user_id, type (free string, no DB enum — FRIEND_REQUEST_RECEIVED/ACCEPTED, GROUP_JOINED/CHECKIN/DELETED, CHALLENGE_INVITE/CHECKIN/DELETED, NUDGE, WEEKLY_SUMMARY/MONTHLY_SUMMARY/YEARLY_SUMMARY), title, body, group_id, challenge_id, habit_id, period_start (period-summary types only), read, created_at.

**Account deletion** (`DELETE /api/users/me`) cascades across every table a user owns — habits, check-ins (and cheers), goals, coach messages, push tokens, feedback, challenge check-ins/participation, friendships, group membership — before deleting the `users` row and the Firebase Auth user itself (best-effort). If the deleted user was the sole creator of a shared group or challenge, that whole group/challenge is deleted too for every other member — there's no ownership-transfer feature.

## UI conventions (finalized designs — build to match, don't reinterpret)

### Insights screen
Pattern-detection cards (directional label, match %, nudge) are removed as of 2026-10-04. The screen is now: a consistency ring for the selected period (Daily/Weekly/Monthly/Yearly tabs, with prev/next period navigation added in Phase 10), with a trend delta badge — tapping opens `ConsistencyDetailModal`: a horizontal habit picker, a bar graph of period-bucketed history, a plain-language summary. Plus an "Ask Habituate" entry card with 3 suggested starter questions, opening `AskHabituateModal`.

### Community screen
"Shared Habits" section is first and separate from "Challenges" — never combine them. Each Shared Habit card shows habit name, participants, time, the streak rule, current group streak length, and a status-driven visual (safe/at-risk/frozen — frozen reads as a distinct frost/shield icon, not a broken streak with an asterisk). "Challenges" below shows progress-bar-style, time-boxed goals with participant avatars — no streak mechanics there.

### General
No red X for missed days, anywhere. Trend framing over perfection framing in all copy. Streak-freeze state must always have its own visual treatment before streak-pressure mechanics ship.

## Notable deliberate tradeoffs

- **Home-screen widgets are the one approved exception to staying Expo-Go-friendly.** Real OS widgets (iOS WidgetKit, Android App Widgets) have no managed-workflow alternative — building this required `expo-dev-client`, `@bacons/apple-targets` (iOS), `react-native-android-widget` (Android), and accepting that testers now need a custom EAS dev-client build instead of plain Expo Go, for the whole app going forward, not just the widget.
- **Friend profile privacy defaults to PRIVATE** for every account, new or existing, enforced at the app layer. A private profile shows name/username/avatar plus any Shared Habit streak the viewer and target are both currently active members of together — reasoned the same way as `check_in_cheers`: a group streak you already co-track isn't really "their private data" from your side. Public additionally shows aggregate-only stats (best streak, consistency %, member-since) — never a per-habit breakdown.
