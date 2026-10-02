# SKILLS.md — Build order for Habituate

Work through these phases in order. Don't start a phase until the previous one's exit criteria are met — this is a solo build and sequencing is what keeps it shippable. Check items off as you go; this file should reflect real progress, not the plan.

**Standing rule — production readiness isn't Phase 10's job alone.** The end goal is a real Play Store/App Store release used by many people, not a personal build (see CLAUDE.md's "Deployment target"). When a phase below involves an infra, library, or data-model choice, default to the store-compatible and scale-sane option over the fastest shortcut — e.g. Expo Go/EAS-compatible libraries over ones that force ejecting, and query patterns that stay fast once `check_ins` has millions of rows rather than thousands. Phase 10 is the explicit gate that catches anything still deferred before launch — it's not where production-mindedness starts.

---

## Phase 0 — Scaffolding
**Goal:** empty but runnable skeleton, locally. This is a mobile app only — no web/browser target. Every screen is built and tested as a mobile layout from the start.

- [x] Repo structure: `/mobile`, `/api`, `/streaming`, `/infra`
- [x] Docker Compose: Postgres, Kafka, Zookeeper running locally
- [x] Spring Boot project boots, connects to Postgres, health check endpoint works
- [x] Expo project boots via Expo Go on a physical device or simulator, hits the health check endpoint
  - Verified: docker-compose services are running; Spring Boot started and returned {"service":"habituate-api","status":"ok"} at /api/health; mobile has Expo start scripts and App.js configured to reach the API (verified 2026-09-13)

**Tooling note — Android Studio is not required to start.** Expo's managed workflow runs on a physical phone through the Expo Go app (scan a QR code, no native build needed) or on iOS Simulator (Mac + Xcode). You only need Android Studio once you specifically need:
- A local Android emulator instead of a physical device, or
- A native module that requires a config plugin / custom native code (triggers `expo prebuild`, which generates a real Android project you'd open in Android Studio to debug)

For as long as the app stays in Expo's managed workflow with Expo Go–compatible libraries, skip installing Android Studio entirely — test on your own phone via Expo Go, and use EAS Build (Expo's cloud build service) when you need a real installable binary (TestFlight/Play Store internal testing). Revisit this only if a library you add isn't supported in Expo Go.

**Exit criteria:** you can run `docker compose up`, start the API, start the mobile app in Expo Go on your phone, and see a successful ping from mobile to API.

---

## Phase 1 — Navigation skeleton + shared components
**Goal:** the app's structural spine and the visual primitives every screen reuses — built once, matching the finalized UI designs, before any screen is completed.

- [x] Bottom tab navigation wired up: Today, Habits, Insights, Community, Profile — all five routes exist and switch correctly, screens are empty placeholders
- [x] Shared design tokens (`mobile/theme.js`) — colours, spacing, radii, type scale, and the one canonical safe/at_risk/frozen streak palette
- [x] Shared component: habit card (used on Today and Habits screens) — category chip, cadence, composed streak indicator, circular check target
- [x] Shared component: streak indicator, with all three visual states designed earlier — safe / at-risk / frozen (grace token)
- [x] Shared component: consistency/progress ring (used on Today and Insights) — real SVG arc driven by percent
- [x] Shared component: "Pattern detected" / insight card (directional label, match %, nudge slot)
- [x] Shared component: shared-habit card (participants, streak rule badge, group streak + status)
- [x] All shared components built and reviewed against the mobile mockups directly — mobile screen widths and touch targets, not a responsive web layout
  - Verified 2026-09-13: rebuilt against `design/*.png` after an audit found the first pass were stubs (the ring never drew an arc, the insight card had no directional label or nudge slot, the shared-habit card had no participants/rule/status, and Today re-implemented all of them inline instead of importing them). Bundle builds clean and all five tabs render with no console errors; the Profile playground exercises every component in every designed state.

**Structure note:** screens live in `mobile/screens/`, network access is centralised in `mobile/api/client.js`, and habit state/streak logic lives in `mobile/hooks/useHabits.js` — per the "thin screens, single API client" convention in `CLAUDE.md`. `App.js` is navigation only.

**Exit criteria:** navigating between all five tabs works, and every shared component renders correctly in isolation (a simple component playground screen is fine) before being wired into real data.

---

## Phase 2 — Core tracking MVP (Today + Habits pages, fully complete)
**Goal:** the basic habit loop works end to end, no streaming, no insights yet. Build Today, then Habits, each to completion before moving to the next page — not both half-done in parallel.

- [x] Firebase Auth wired up (sign up, login, logout); backend verifies the Firebase ID token server-side on every request
  - Implemented 2026-09-17: Firebase JS SDK in mobile (`firebase.js`, `hooks/useAuth.js`); `LoginScreen` + `SignupScreen` with email/password; `App.js` gates tabs behind auth state. Backend: `FirebaseConfig` initialises Firebase Admin SDK from `firebase.service-account-path`, `FirebaseAuthFilter` verifies Bearer tokens and sets `userId` request attribute (falls back to `demo-user` when no service account is configured for local dev), `SecurityConfig` registers the filter. `HabitController` now reads `userId` from the request attribute — `?userId=` query param removed from all endpoints. **Action required:** create a Firebase project and set `EXPO_PUBLIC_FIREBASE_*` env vars in mobile and `firebase.service-account-path` in the API before deploying (see README for steps).
- [x] `habits` table + CRUD API (create, edit, archive, restore, permanent delete)
- [x] `check_ins` table + log/undo check-in API
- [x] Cadence types (daily / weekly / monthly) stored and enforced in UI
  - Stored, used to group the Habits list, and `cadenceTarget` now drives per-period progress on Today (client-side in `mobile/utils/cadence.js`). Daily targets count check-ins; weekly/monthly targets count distinct days. Moving this server-side goes with the streak work.
  - **Superseded 2026-09-20** by independent multi-scale targets — see below. `cadenceType` is now effectively vestigial (always saved as `DAILY`); which section(s) a habit appears in is driven by which of `cadenceTarget` / `weeklyTarget` / `monthlyTarget` are set, not by this field. Period-progress logic is still entirely client-side in `mobile/utils/cadence.js`; only streak calculation actually moved server-side.
- [x] **Today page complete**: today's habits list using the shared habit card, check-in tap interaction, today's progress summary, non-punitive empty state
  - Rebuilt 2026-09-16 against `design/Today.png`: greeting header with display name + avatar, progress card (count, check badge, linear bar, encouragement copy), "Daily Habits" section header with a "See all" link to the Habits tab, and the compact `HabitCard variant="today"` row (category icon tile, habit time, green check when done / neutral "+" when not). Cadence is treated as "times per period": a habit shows under "Daily Habits" (and counts toward today's progress) when its cadence leaves no slack — every daily habit, a weekly habit targeting all 7 days, or one whose remaining check-ins equal the days left in the period. Everything else sits in "This Week" / "This Month", still loggable, showing period progress ("1 of 3 this week") rather than being counted against today. Logic lives in `mobile/utils/cadence.js` and is attached to each habit by `useHabits`. Weekly/monthly rows carry a period progress bar, tapping any row expands it to show when it was logged (today's time plus the period's / recent check-ins), and a check-in fires a short motivational banner (`components/MotivationBanner.js`, copy in `constants/motivation.js`) — never on an undo. The display name is a placeholder constant in `mobile/constants/profile.js` until Firebase Auth lands.
  - **Updated 2026-09-20:** the "slack ran out" escalation into the daily section was removed — a weekly/monthly-only habit (e.g. gym 2×/week) is never pulled into today's count just because time is running low; it always lives in "This Week"/"This Month" with its own period progress. The section itself was renamed **"Due Today"** (was "Daily Habits") since it was never really cadence-based — it's whatever genuinely needs action today. **Decision:** this label is being kept over the literal "Daily Habits" text in `design/Today.png` — it's a better fit for the multi-scale-target model than the original mockup copy, not a gap to close.
- [x] Optional per-habit ideal time + reminder toggle (`scheduledTime`, `reminderEnabled` on `habits`), shown on Today and editable in the add/edit habit form. Reminder delivery itself waits for FCM in Phase 9.
- [x] **Habits page complete**: cadence-grouped habit list (Daily/Weekly/Monthly), add/edit habit flow, calendar grid view per habit (mirrors the paper tracker layout — days across, habits down)
  - Completed 2026-09-19: single calendar icon (top-right of Habits header) opens a full-page `CalendarModal`. Monthly grid (Mon–Sun columns, weeks as rows) shows coloured dots per habit checked in each day. Tap any day to see which habits were completed. Prev/next month navigation. Monthly summary bar chart below. Timezone bug fixed: all date keys use local time (matching `toDateKey` in `date.js`) so a Thursday check-in always shows on Thursday.
  - **Updated 2026-09-20:** fixed a grouping bug where every habit duplicated into Daily plus Weekly/Monthly (Daily's filter was unconditionally `true`); each habit now appears in exactly one section, matching Today's priority (real daily target → Daily; else weekly target → Weekly; else monthly-only → Monthly).
  - **Calendar rebuilt 2026-09-20:** replaced the flat same-colour dot cluster with a completion heatmap — green when every daily-target habit that day is done, amber when some are, grey/plain when none are (weekly/monthly-only habits show as a separate blue dot instead, since they can't fairly grade a single day); a legend explains all four indicators. The day-detail card now shows a "% done" badge, a "N daily habits · M completed" subtitle, three stat tiles (Completed / Remaining / Day streak), and a fuller per-habit row (checked/unchecked state, logged quantity for count habits). Fixed two bugs along the way: a duplicate-key crash when a count-mode habit logged multiple check-ins in one day, and a retroactive-completion bug where adding a new habit today made past days look incomplete for a habit that didn't exist yet (now gated on each habit's `createdAt`). **Decision (2026-09-20):** leaving the remaining `design/Calendar.png` gaps as-is for now — it stays a modal that hides the tab bar (rather than a page), and the week starts Monday instead of the design's Sunday-first header. Revisit only if there's a specific reason to.
  - **Backdated check-ins added 2026-10-01:** the day-detail panel's per-habit rows are now tappable — toggles a BOOLEAN habit's check-in for whatever past day you selected, as far back as the habit's own `createdAt`, blocked for future days. Scoped to BOOLEAN daily-target habits only for now; COUNT habits (what amount? which check-in to undo?) and weekly/monthly-only habits (no "due this day" concept) stay view-only in the calendar. `HabitService.createCheckIn` now validates server-side too (rejects a future `occurredAt` or one before the habit existed) rather than trusting the client, and both checks — plus the existing duplicate-day guard — bucket in the client's own timezone (the `X-Timezone` header, same mechanism as streaks) instead of hardcoded UTC. Streaks need no special handling — `StreakCalculator` already recomputes from the full check-in history every time, so a backdated check-in just naturally extends it.
- [x] Streak calculation (current + longest) wired into the shared streak indicator component
  - Completed 2026-09-19: `StreakCalculator.java` computes both `currentStreak` and `longestStreak` server-side from check-in history. `HabitResponse` now includes both fields. `HabitService` enriches every habit response (list, create, update) with streak data. Mobile `useHabits.js` reads `currentStreak`/`longestStreak` from the API response, falling back to client-side computation only if the API omits them.
- [x] **Added 2026-09-20 (beyond original scope): independent weekly/monthly targets + count-mode tracking.** A habit can now carry `cadenceTarget` (per-day), `weeklyTarget`, and `monthlyTarget` simultaneously and independently (e.g. gym: no daily target, `weeklyTarget=2`, `monthlyTarget=12`) — see `CLAUDE.md`'s data model for the schema. Each habit also has a `trackingMode`: `BOOLEAN` (default, one check-in a day, toggled) or `COUNT` (any number of check-ins a day, each with a `value`; period totals sum values instead of counting distinct days). This is what makes a target like "50 job applications this month" reachable at all — under the old distinct-day counting it was capped at the number of days in the month. Mobile: `HabitCard` shows a +/− stepper (plus a batch-amount entry) for `COUNT` habits instead of the single check toggle; the add/edit form has a "How do you check in?" picker.

**Exit criteria:** you can create a habit, check it in daily for a week, see a streak number, and see it on a grid — both Today and Habits pages fully match the mockups, not just functionally present. *(Met, with two accepted, deliberate deviations from the mockups noted above: the "Due Today" label on Today, and the calendar's modal presentation/Monday week-start.)*

---

## Phase 3 — Goals layer
**Goal:** weekly/monthly goals independent of a single habit. Folds into the Habits page rather than being its own tab.

- [x] `goals` table + API
  - Completed 2026-09-21, but scoped differently than originally planned: since habits already carry their own `weeklyTarget`/`monthlyTarget` (Phase 2), a "habit-linked goal" as a separate DB row would just duplicate a number that already exists and risk it drifting out of sync. Instead, `goals` (new `com.habituate.api.goals` package: `Goal`, `GoalRepository`, `GoalService`, `GoalController`) stores **freeform goals only** — `description`, `period` (WEEKLY/MONTHLY), `targetCount`, `currentCount`, `periodStart`. Habit-linked goals are just a habit with `featuredGoal=true` on `Habit` — no new storage, it reuses the habit's existing target and check-ins.
  - Endpoints: `GET/POST /api/goals`, `PUT /api/goals/{id}`, `POST /api/goals/{id}/progress` (±delta), `POST /api/goals/{id}/rollover`, `DELETE /api/goals/{id}`.
- [x] Mobile: add a goal (habit-linked or freeform), progress bar
  - `useGoals` hook (mirrors `useHabits`' shape) plus `useFeaturedGoalReviews`. New "Goals" section on the Habits page (between the habit form and the cadence-grouped lists): featured-habit cards (reusing `HabitCard` as-is), freeform `GoalCard`s (progress bar, +/- stepper, and an "Add progress" batch-amount field for lump-sum targets like a dollar goal — a plain ±1 stepper doesn't work for "$500"), and a "+ New goal" form. The habit edit form gained a "Feature on Goals" toggle, shown only once a weekly/monthly target is set. A `GoalsSummaryCard` on the Today page ("N of M completed · X% avg. progress", tapping it jumps straight to the Goals section) surfaces goal progress without duplicating the full cards there.
- [x] End-of-period review screen (hit/missed, simple rollover option)
  - Freeform goals: `needsReview` is computed client-side (`useGoals`) by comparing the goal's stored `periodStart` against the client's own current period start — when they diverge, `GoalCard` swaps its stepper for a review ("10 of 12 last month") with Roll over (fresh period, same target) / Dismiss (archives it) actions.
  - Habit-linked goals: no rollover needed since the habit's target just keeps recurring — `previousPeriodStats` (`cadence.js`) derives "last month" stats purely from check-ins the habit already has, and `useFeaturedGoalReviews` tracks which period-transitions have already been shown in `AsyncStorage` only (not the backend, since it's just "have I seen this" UI state).

**Exit criteria:** a monthly goal like "10 days of gym" shows live progress against the linked habit's check-ins. *(Met — via the `featuredGoal` pin, not a separate goal record.)*

---

## Phase 4 — Event backbone
**Goal:** every check-in also becomes a Kafka event, nothing consumes it yet.

- [x] `checkin-events` Kafka topic created
  - Declared explicitly via a `NewTopic` bean (`events.KafkaTopicConfig`), 1 partition/1 replica — matches what Kafka's own auto-create would produce locally, but documents the topic as part of the app rather than relying on an implicit side effect.
- [x] API publishes to the topic on every check-in write, same request
  - `events.CheckInEventPublisher`, called from `HabitService.createCheckIn`/`deleteCheckIn` right after the Postgres write. The send is awaited with a 5s timeout so a broker outage fails the request instead of silently dropping the event — not a full transactional outbox (the Postgres write can't roll back once committed), just a best-effort v1 per the note in `CLAUDE.md`.
- [x] Basic consumer that just logs events, to confirm the pipe works
  - `events.CheckInEventLogger` — a `@KafkaListener` in the same `api` app (no separate `/streaming` project yet; that's Phase 6's Flink job). Verified 2026-09-24: produced a test `CheckInEvent` JSON message directly to the topic and confirmed it arrived at the logger with correct deserialization.

**Exit criteria:** checking in on mobile produces a visible event in the Kafka topic within your local setup. *(Verified at the Kafka level — topic creation, JSON (de)serialization, and the listener all confirmed working end-to-end with a test message. The mobile→API→Kafka path through a real authenticated check-in hasn't been separately exercised — Firebase Admin SDK is live in this environment, so an unauthenticated curl can't reach the endpoint; the producer code itself is a straightforward synchronous `KafkaTemplate.send` using the same topic/serialization already proven.)*

---

## Phase 5 — Insights engine v1 (simple, batch) — Insights page complete
**Goal:** prove the insight concept before adding Flink complexity, and finish the Insights page end to end.

- [x] Nightly job (plain scheduled task, no Flink yet) computes pairwise, directional correlation over the last 30 days per user (P(habit B completed | habit A completed))
  - Completed 2026-09-30: new `com.habituate.api.insights` package. `CorrelationEngine` (pure, unit-tested) defines "habit completed on day d" as that day's logged values summing to at least `cadenceTarget` — a uniform per-day bar across BOOLEAN and COUNT habits, deliberately simpler than mobile's full daily/weekly/monthly section logic in `cadence.js`, since correlation only cares "did you do X today." Bucketed in UTC (not per-user timezone like `StreakCalculator`) since this is a server-initiated nightly job with no HTTP request to carry an `X-Timezone` header — revisit once `users.timezone` exists. `InsightScheduler` runs it at 3am via `@Scheduled`; `InsightController`'s `POST /api/insights/recompute` lets a user (or a test) trigger their own recompute immediately instead of waiting for the cron.
- [x] Minimum sample-size threshold enforced before a correlation is surfaced (don't show "90% match" from 3 data points)
  - **Decision:** `MIN_SAMPLE_SIZE = 5` days and `MIN_SCORE = 0.6` (60%) — both in `InsightService`, not the UI. Sample size is the explicit CLAUDE.md requirement; the score floor is an added product judgment call (a 20% co-occurrence isn't a "pattern detected" moment even with plenty of data) — adjust both if they feel off once there's real usage.
  - **Fixed 2026-10-01 — lift threshold, after real usage surfaced false patterns:** raw `P(B|A)` alone surfaced nonsense like "gym → job applications, 67% match" whenever B just happened to be a generally-frequent habit (logged most days regardless of A) — any two frequent-but-unrelated habits will show a high raw co-occurrence by coincidence. `CorrelationEngine.correlate` now also computes `baseRateB` (B's own completion rate over the window) and `lift = score / baseRateB`; `InsightService.MIN_LIFT = 1.3` requires A to make B at least 30% more likely than B's own baseline before it counts as a real pattern, not just base-rate noise. Also fixed a related complaint ("so many patterns for each habit-to-habit mapping"): A→B and B→A used to both get evaluated and could both surface as separate cards for the same two habits — `computeForUser` now walks unordered pairs and surfaces only the stronger-qualifying direction (by lift). Both directions are still stored in `correlations` per CLAUDE.md's directional-storage note; only the user-facing `insights` row is deduplicated. Recomputing also now actively retracts a previously-surfaced insight that no longer clears the bar (including on a direction flip), instead of leaving a stale card to rot forever — this specifically matters right after tightening a threshold like this one.
  - **Fixed 2026-10-02 — cap on surfaced insights, after real usage still showed "so many of them, all identical":** the lift fix was working correctly — every surfaced pair genuinely cleared sample-size/score/lift — but with only ~6 habits, a user with "good days" (most habits done together) and "off days" (most skipped together) can have *every* pair of habits honestly qualify, since they're all proxies for the same day-level consistency rather than any specific pair being linked. Verified directly against the real account: 15 of 15 possible pairs among 6 habits all cleared the bar. `InsightService.MAX_SURFACED_INSIGHTS = 5` ranks qualifying candidates by `lift * score` and keeps only the strongest few — matches CLAUDE.md's "a handful of cards" design intent for "Pattern detected," not an exhaustive pairwise matrix. The losers (still individually valid, just weaker) get retracted the same way an unqualifying pair does.
- [x] `correlations` and `insights` tables populated, including a generated nudge string per insight
  - `correlations` holds the raw score/sample_size, upserted in place per (user, habitA, habitB, windowDays) rather than accumulating a new row every night. `insights.payload` is a real `jsonb` column (Hibernate's `@JdbcTypeCode(SqlTypes.JSON)`, not a plain string column — verified against the real Postgres dev DB in `InsightServiceTest`) carrying habit names, match %, description, and nudge text, kept separate from the raw stat per CLAUDE.md so copy can be revised without recomputing. Dismissing an insight (`dismissedAt`) is permanent against recompute — a nightly rerun won't resurrect a dismissed pairing even if the stat is still true.
- [x] **Insights page complete**: consistency ring (Daily/Weekly/Monthly/Yearly tabs), "Pattern detected" cards using the shared insight card component (directional label, match %, one-sentence non-causal description, evidence-based nudge)
  - Built against `design/Insights.png`. The ring's exact formula is a product interpretation, not a literal spec (the mockup's "84%" and "5.8/7" aren't algebraically identical to each other either): `mobile/utils/consistency.js` computes a smooth average daily-completion ratio for the ring percent, and a separate "fully-complete-days" count for the center fraction, over a rolling window per tab (1/7/30/365 days — approximate, not calendar-exact months/years). Days before any habit existed are excluded from the ring average entirely (not counted as 0%), so a new account's Yearly tab isn't tanked by the many days before signup. Trend badge compares against the immediately preceding window of equal length. Anti-guilt copy tiers in `consistencyMessage()` — no shaming language even at 0%.

**Exit criteria:** after a couple weeks of check-in data, the app surfaces at least one correct, sensible correlation with the full card treatment, and the Insights page fully matches the mockup — not just the underlying data being correct. *(Met: 31 backend tests covering the correlation math, lift, the surfaced-insight cap, threshold suppression, and dismissal-survives-recompute, run against the real dev Postgres DB. Also verified directly against a real account's real usage data (not just synthetic test data) — confirmed correlations were surfacing, then confirmed the lift and cap fixes correctly cut a real account's 15 surfaced patterns down to 5 honest ones. Still not independently verified: clicking through the actual UI in a browser/device — no browser automation tool is available in this environment — but the user has been using the real Insights page directly and reporting back, which is stronger evidence than a solo click-through would be.)*

---

## Phase 6 — Insights engine v2 (real-time, Flink)
**Goal:** replace the nightly batch job with the real-time pipeline. No new UI — this phase upgrades what's already on the Insights page.

**Before starting — cost check, not a given:** a managed Flink job plus MSK has real fixed infrastructure cost regardless of how many users you have, unlike the batch job in Phase 5 which just runs on the existing API's compute. "Works for many users" is about the app surviving load, not about every subsystem being real-time from day one. Confirm with actual Phase 5 usage (does the batch job's latency actually bother users, or is "real-time-triggered, not instant-accurate" from CLAUDE.md already good enough) before paying for this — it's fine to stay on Phase 5's batch version through initial launch and revisit this once there's real usage data justifying it.

- [ ] Flink job consumes `checkin-events`, maintains keyed rolling-window state per user/habit
- [ ] Correlation recomputed on meaningful state change, written to `correlations`/`insights`, same sample-size threshold enforced in the job
- [ ] Streak-risk prediction added as a second insight type
- [ ] Push notification on new high-confidence insight

**Exit criteria:** a new check-in updates the insights feed without waiting for a nightly job.

---

## Phase 7 — Streaks and groups — Community page complete
**Goal:** shared habits, group streaks, friend system — kept distinct from generic challenges. Finish the Community page end to end.

- [ ] `friendships` table + friend request flow
- [ ] `groups` and `group_members` tables + create/join group flow, with `streak_rule` (all_members / any_member) set at creation
- [ ] Group check-ins tied to a shared habit
- [ ] `group_streaks` computed via a Kafka consumer filtered by group membership (reuse the existing stream, don't build a new pipeline), with a `status` field (active / at_risk / frozen)
- [ ] `streak_freezes` table + grace-token logic (personal and group)
- [ ] **Community page complete**: "Shared Habits" section (separate from Challenges) using the shared-habit card component — participants, streak rule, group streak length, and the at-risk/safe/frozen visual states
- [ ] Challenges section — time-boxed, multi-person progress bars, no streak mechanics
- [ ] Friend activity feed

**Exit criteria:** two accounts can share a habit, see a live group streak update when either checks in, see the streak visibly change state (safe → at-risk) if a check-in is still pending as the day's window closes, and the Community page fully matches the mockup.

---

## Phase 8 — Habituate Wrapped
**Goal:** shareable recap, built on existing data only.

- [ ] Recap template system (slide types: top habit, streak record, correlation highlight, group highlight)
- [ ] Monthly + annual generation job, reads from `insights`/`correlations`/`check_ins`
- [ ] Export as shareable image card

**Exit criteria:** running the job for a test account produces a coherent, shareable recap with no manual data entry.

---

## Phase 9 — Profile page + polish and retention mechanics
**Goal:** the things that make people keep using it daily. (Account deletion and the privacy policy/ToS pages are store-submission *gates*, not retention polish — they live in Phase 10 so they don't get silently skipped if this phase gets trimmed.)

- [ ] Home-screen widget for quick check-in
- [ ] Push reminder scheduling per habit
- [ ] Data export (CSV/JSON)
- [x] Dark mode
  - Pulled forward and completed ahead of this phase: Light/Dark/System toggle on the Profile page's new "Appearance" section, persisted, System following the OS setting. See `CLAUDE.md`'s "Mobile visual system" note for the `useAppTheme()` pattern every component must follow — this is load-bearing across nearly the whole mobile app, not an isolated feature.
- [ ] Full anti-guilt UX audit: confirm no shaming copy, no red X states, no causal-language leaks in correlation copy, anywhere

**Exit criteria:** you'd hand this to a real user without embarrassment.

---

## Phase 10 — Production infrastructure & launch readiness
**Goal:** safe, stable, and legally compliant to put in front of real strangers at Play Store/App Store scale — not just "it works on my phone and my test account." Many of these items should start incrementally alongside earlier phases (CI, environment separation, migrations) rather than being left for one final sprint; this phase is the gate checked before public launch, not where the work begins.

- [ ] CI pipeline (GitHub Actions): backend tests run on every PR/push (the suite already exists — `api/src/test`); mobile build at minimum syntax/lint-checked until real mobile tests exist
- [ ] Environment separation: distinct Firebase projects, Postgres databases, and Kafka clusters for dev/staging/prod — the shipped app must never point at a laptop's docker-compose
- [ ] Replace `spring.jpa.hibernate.ddl-auto=update` with versioned migrations (Flyway or Liquibase) — auto-updating the schema is fine solo-dev convenience, not safe for a production database you can't just drop and recreate
- [ ] Secrets management: the Firebase service-account key currently lives at a literal filesystem path in `application.properties` — move it (and any other API keys) into a real secret store (AWS Secrets Manager or equivalent) referenced by env var, out of the repo and off any one machine
- [ ] Terraform for the AWS footprint already decided in CLAUDE.md (ECS Fargate, RDS, MSK) — actually provisioned, not just planned
- [ ] API rate limiting / basic abuse protection on public endpoints — nothing currently stops one client from hammering `/api/habits/{id}/check-ins`
- [ ] Crash reporting + error tracking wired up on both mobile (Sentry or similar) and backend (structured logs plus an APM/error aggregator) — so you find out from a dashboard, not a support email
- [ ] Database review before scale: add indexes on `check_ins(habit_id, occurred_at)` and `check_ins(user_id, occurred_at)` (every streak/calendar/correlation query filters on these), size the connection pool for real concurrency, and have an actual backup/restore plan for Postgres
- [ ] Kafka review before scale: the dev `checkin-events` topic is 1 partition/1 replica (see `KafkaTopicConfig`) — fine for local dev, not for production throughput or durability
- [ ] Mobile release pipeline: EAS Build + EAS Submit configured for both stores, a real app versioning scheme, and EAS Update wired up for JS-only fixes without a full store review cycle
- [ ] Privacy policy and Terms of Service published and linked from the app (required by both stores once Firebase Auth collects user data)
- [ ] In-app account deletion flow — Apple requires this for any app with account creation; sign-out alone doesn't satisfy it
- [ ] Store listing compliance: screenshots, description, Play Store Data Safety form and Apple App Privacy details filled out accurately (they ask what data you collect and why — Firebase Auth, check-in data, etc. all need honest answers)
- [ ] Load/smoke test the check-in write path (API write + Kafka publish, now `@Transactional` per the recent fix) at a realistic concurrent-user estimate before announcing a public launch

**Exit criteria:** a stranger can download the app from the Play Store, create an account, use it daily, and — if something breaks — you find out from an error dashboard before they have to email you.

---

## Backlog (post-launch, not before)

- [ ] Photo/OCR import from a physical paper tracker
- [ ] Wearable integration (Apple Health / Google Fit) for auto-logged habits
- [ ] Broader social features beyond groups (public leaderboards, discovery)

Do not pull these forward without a specific reason — they're each a real subsystem, not a quick add.
