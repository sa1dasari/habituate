# CLAUDE.md — Habituate build context

This file is the standing context for any AI assistant (Copilot, Claude, etc.) working on this repo. Read this before generating code. It describes what the app is, why decisions were made, the current architecture, and the conventions to follow. Keep this file updated as decisions change — it should always reflect the real state of the project, not the original plan.

Global design rule (applies to all phases):
- Design-first, mobile-first: the /design assets are the canonical UI spec for every phase. Implementations must prioritize native mobile device layouts, use mobile-optimized component sizes and touch targets, and match design tokens for colors, spacing, and typography. The Expo web preview is permitted for development convenience but is not the acceptance target.

## What this app is

Habituate is a habit-tracking app with three differentiators over generic trackers:
1. A real-time correlation engine that surfaces relationships between habits.
2. Shared/group habits with Snapchat-style streaks.
3. Anti-guilt UX — no punitive red X's, streak freezes, trend framing.

Do not add features outside the scope defined in `SKILLS.md` without updating that file first. Scope creep is the main risk on a solo build with this much backend complexity.

Competitive note: habit-tracker-with-friends apps (HabitShare, Habit Huddle, Done, HabitHook) and habit-correlation apps (Daylio, Bearable, Tracka) both already exist individually. Habituate's actual differentiation is the *combination* plus rigor: real windowed statistical correlation (not an LLM guessing at patterns), an explicit per-group streak rule, and a Wrapped-style recap as a distribution mechanic. Don't let the build drift toward a generic version of either category.

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

### Insight path
Kafka (`checkin-events`) → Flink job → maintains keyed state: a rolling N-day boolean matrix of habit completion per user → recomputes pairwise correlation on state change → writes to insights store → API serves it to mobile, and a push notification fires for high-confidence new insights.

**Important nuance:** check-ins are sparse (a handful of taps a day). Per-event correlation math is meaningless. The "real-time" part is that the pipeline is event-triggered, not batch-scheduled — the actual insight quality still needs weeks of accumulated data. Don't oversell this in-app copy; set onboarding expectations accordingly.

**Correlation must be directional and honestly framed.** The finalized Insights screen shows patterns as "Habit A → Habit B" with a match percentage (e.g. "Morning Coffee → Morning Walk, 90% match"). This is a conditional probability (P(B completed | A completed)), not a causal claim. All in-app copy, the Flink output schema, and any generated "nudge" text must preserve this distinction — never phrase it as "X causes Y" or "X helps you do Y." Use language like "you complete Y on X% of the days you complete X."

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
- `correlations` — id, user_id, habit_a_id, habit_b_id, window_days, score, sample_size, computed_at
  - `habit_a_id` → `habit_b_id` is directional (A is the trigger habit, B is the outcome habit) to support the "A → B" display; store both directions if both are statistically meaningful, don't assume symmetry
- `insights` — id, user_id, type (correlation / streak_risk / trend), payload (jsonb), generated_at, dismissed_at
  - payload for a `correlation` insight includes the nudge text, kept separate from the raw stat so copy can be revised without recomputing
- `friendships` — user_id, friend_id, status (pending/accepted), created_at
- `groups` — id, habit_id (nullable), name, created_by, streak_rule (all_members / any_member)
- `group_members` — group_id, user_id, joined_at
- `group_streaks` — group_id, current_streak, longest_streak, last_qualifying_date, status (active / at_risk / frozen)
  - `status` drives the visual state on the Shared Habits card — `at_risk` when the streak's qualifying window is still open today but not yet satisfied, `frozen` when a grace token has been applied
- `streak_freezes` — id, user_id or group_id, used_on_date, source (personal_grace / group_grace)

## UI conventions

These reflect the finalized Insights and Community screen designs — build to match, don't reinterpret.

### Insights screen
- Top: consistency ring for the selected period (Daily/Weekly/Monthly/Yearly tabs), with a trend delta badge (e.g. "+12%")
- Below: "Pattern detected" cards, one per significant correlation, each with:
  - A directional label ("Habit A → Habit B")
  - A match percentage badge
  - One sentence of plain-language, non-causal description
  - A progress-bar-style visual echoing the match percentage
  - An attached "Evidence-based nudge" — a concrete suggested action, visually distinct from the stat itself
- Only surface a pattern once `sample_size` clears a minimum threshold (define this in the Flink job, not the UI) — don't show a "90% match" based on three data points.

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

### General
- No feature ships without updating `SKILLS.md`'s checklist for that phase.
- Anti-guilt UX rules are non-negotiable in any check-in or streak UI: no red X for missed days, no shaming copy, streak freezes must exist before streak pressure mechanics ship.
- When in doubt about scope, prefer shipping the current phase in `SKILLS.md` over adding a new capability.

## Current phase

See `SKILLS.md` for the active phase and what's done vs. pending. Update that file, not this one, as phases complete.
