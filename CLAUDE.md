# CLAUDE.md — Habituate build context

This file is the standing context for any AI assistant (Copilot, Claude, etc.) working on this repo. Read this before generating code. It describes what the app is, why decisions were made, the current architecture, and the conventions to follow. Keep this file updated as decisions change — it should always reflect the real state of the project, not the original plan.

## What this app is

Habituate is a habit-tracking app with three differentiators over generic trackers:
1. A real-time correlation engine that surfaces relationships between habits.
2. Shared/group habits with Snapchat-style streaks.
3. Anti-guilt UX — no punitive red X's, streak freezes, trend framing.

Do not add features outside the scope defined in `SKILLS.md` without updating that file first. Scope creep is the main risk on a solo build with this much backend complexity.

## Tech stack and why

- **Mobile: React Native (Expo).** Single codebase for iOS/Android, fastest path to both platforms for a solo builder.
- **Backend: Spring Boot (Java).** Primary language of the developer; also the natural home for the correlation engine's orchestration logic.
- **Postgres.** Relational source of truth for users, habits, check-ins, goals, groups.
- **Kafka.** Event backbone. Every check-in is published as an event, not just written to Postgres. This is what makes the insights engine real-time instead of a nightly batch job.
- **Flink.** Stateful stream processing for the correlation engine. Keeps a rolling per-user, per-habit window of completion data and recomputes correlation when that state changes meaningfully.
- **Firebase Auth + FCM.** Don't roll custom auth or push infra for a solo project.
- **Terraform + AWS (ECS Fargate, RDS, MSK).** Fargate over EKS/K8s — simpler ops for a single maintainer. Revisit only if there's a specific reason to need K8s.

## Architecture

### Write path
Mobile app → Spring Boot API → writes to Postgres (source of truth) AND publishes to Kafka topic `checkin-events`, in the same request. Postgres write and Kafka publish must not drift — if one fails, the request fails (use a transactional outbox pattern if this becomes a reliability issue).

### Insight path
Kafka (`checkin-events`) → Flink job → maintains keyed state: a rolling N-day boolean matrix of habit completion per user → recomputes pairwise correlation on state change → writes to insights store → API serves it to mobile, and a push notification fires for high-confidence new insights.

**Important nuance:** check-ins are sparse (a handful of taps a day). Per-event correlation math is meaningless. The "real-time" part is that the pipeline is event-triggered, not batch-scheduled — the actual insight quality still needs weeks of accumulated data. Don't oversell this in-app copy; set onboarding expectations accordingly.

### Groups / social
Group check-ins and activity feeds reuse the same Kafka `checkin-events` stream — a group is just a filtered consumer of the same events, not a separate pipeline. Don't build a parallel system for this.

### Wrapped / recap
Reads from the existing insights store and check-in history. No new pipeline — this is a presentation/templating layer on data that already exists.

## Data model

- `users` — id, email, auth_provider, timezone, created_at
- `habits` — id, user_id, name, category, cadence_type (daily / weekly / monthly), cadence_target, color, archived_at
- `check_ins` — id, habit_id, user_id, occurred_at, value, source (manual / ocr_import), group_id (nullable)
- `goals` — id, user_id, period (week/month), habit_id (nullable), target_count, description
- `correlations` — id, user_id, habit_a_id, habit_b_id, window_days, score, sample_size, computed_at
- `insights` — id, user_id, type (correlation / streak_risk / trend), payload (jsonb), generated_at, dismissed_at
- `friendships` — user_id, friend_id, status (pending/accepted), created_at
- `groups` — id, habit_id (nullable), name, created_by, streak_rule (all_members / any_member)
- `group_members` — group_id, user_id, joined_at
- `group_streaks` — group_id, current_streak, longest_streak, last_qualifying_date

## Conventions

### Backend (Spring Boot)
- Package by feature, not by layer (`habits/`, `checkins/`, `insights/`, `groups/`), each with its own controller/service/repository.
- REST, not GraphQL, for v1 — keep the surface simple while the app is still one developer.
- Every write that should trigger a Kafka event does so inside the service layer, not the controller.
- DTOs at the API boundary; never expose JPA entities directly.

### Mobile (React Native / Expo)
- Functional components, hooks only, no class components.
- API calls centralized in a single client module, not scattered `fetch` calls.
- Keep screen components thin; business logic in hooks or a shared state layer.

### General
- No feature ships without updating `SKILLS.md`'s checklist for that phase.
- Anti-guilt UX rules are non-negotiable in any check-in or streak UI: no red X for missed days, no shaming copy, streak freezes must exist before streak pressure mechanics ship.
- When in doubt about scope, prefer shipping the current phase in `SKILLS.md` over adding a new capability.

## Current phase

See `SKILLS.md` for the active phase and what's done vs. pending. Update that file, not this one, as phases complete.
