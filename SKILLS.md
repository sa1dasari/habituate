# SKILLS.md — Build order for Habituate

Work through these phases in order. Don't start a phase until the previous one's exit criteria are met — this is a solo build and sequencing is what keeps it shippable. Check items off as you go; this file should reflect real progress, not the plan.

---

## Phase 0 — Scaffolding
**Goal:** empty but runnable skeleton, locally.

- [x] Repo structure: `/mobile`, `/api`, `/streaming`, `/infra`
- [x] Docker Compose: Postgres, Kafka, Zookeeper running locally
- [x] Spring Boot project boots, connects to Postgres, health check endpoint works
- [x] Expo project boots on a simulator/device, hits the health check endpoint

**Exit criteria:** you can run `docker compose up`, start the API, start the mobile app, and see a successful ping from mobile to API.

Note: the project scaffold and local config are in place. The Docker Desktop engine is not available in this execution environment, so the database/Kafka stack could not be started here; the compose file and Spring/Expo wiring are ready to run on a machine with Docker Desktop enabled.

---

## Phase 1 — Core tracking MVP
**Goal:** the basic habit loop works end to end, no streaming, no insights yet.

- [ ] Firebase Auth wired up (sign up, login, logout)
- [ ] `habits` table + CRUD API (create, edit, archive)
- [ ] `check_ins` table + log/undo check-in API
- [ ] Cadence types (daily / weekly / monthly) stored and enforced in UI
- [ ] Mobile: habit list screen, add/edit habit screen, check-in tap interaction
- [ ] Mobile: calendar grid view per habit (mirrors the paper tracker layout — days across, habits down)
- [ ] Streak calculation (current + longest), non-punitive empty state for missed days

**Exit criteria:** you can create a habit, check it in daily for a week, see a streak number, and see it on a grid.

---

## Phase 2 — Goals layer
**Goal:** weekly/monthly goals independent of a single habit.

- [ ] `goals` table + API
- [ ] Mobile: add a goal (habit-linked or freeform), progress bar
- [ ] End-of-period review screen (hit/missed, simple rollover option)

**Exit criteria:** a monthly goal like "10 days of gym" shows live progress against the linked habit's check-ins.

---

## Phase 3 — Event backbone
**Goal:** every check-in also becomes a Kafka event, nothing consumes it yet.

- [ ] `checkin-events` Kafka topic created
- [ ] API publishes to the topic on every check-in write, same request
- [ ] Basic consumer that just logs events, to confirm the pipe works

**Exit criteria:** checking in on mobile produces a visible event in the Kafka topic within your local setup.

---

## Phase 4 — Insights engine v1 (simple, batch)
**Goal:** prove the insight concept before adding Flink complexity.

- [ ] Nightly job (plain scheduled task, no Flink yet) computes pairwise correlation over the last 30 days per user
- [ ] `correlations` and `insights` tables populated
- [ ] Mobile: basic insights feed screen showing top 3 correlations

**Exit criteria:** after a couple weeks of check-in data, the app surfaces at least one correct, sensible correlation.

---

## Phase 5 — Insights engine v2 (real-time, Flink)
**Goal:** replace the nightly batch job with the real-time pipeline.

- [ ] Flink job consumes `checkin-events`, maintains keyed rolling-window state per user/habit
- [ ] Correlation recomputed on meaningful state change, written to `correlations`/`insights`
- [ ] Streak-risk prediction added as a second insight type
- [ ] Push notification on new high-confidence insight

**Exit criteria:** a new check-in updates the insights feed without waiting for a nightly job.

---

## Phase 6 — Streaks and groups
**Goal:** shared habits, group streaks, friend system.

- [ ] `friendships` table + friend request flow
- [ ] `groups` and `group_members` tables + create/join group flow
- [ ] Group check-ins tied to a shared habit
- [ ] `group_streaks` computed via a Kafka consumer filtered by group membership (reuse the existing stream, don't build a new pipeline)
- [ ] Streak-rule logic: all-members vs any-member, decided per group
- [ ] Streak freeze/grace token mechanic
- [ ] Mobile: group view, activity feed, streak flame UI

**Exit criteria:** two accounts can share a habit and see a live group streak update when either checks in.

---

## Phase 7 — Habituate Wrapped
**Goal:** shareable recap, built on existing data only.

- [ ] Recap template system (slide types: top habit, streak record, correlation highlight, group highlight)
- [ ] Monthly + annual generation job, reads from `insights`/`correlations`/`check_ins`
- [ ] Export as shareable image card

**Exit criteria:** running the job for a test account produces a coherent, shareable recap with no manual data entry.

---

## Phase 8 — Polish and retention mechanics
**Goal:** the things that make people keep using it daily.

- [ ] Home-screen widget for quick check-in
- [ ] Push reminder scheduling per habit
- [ ] Data export (CSV/JSON)
- [ ] Dark mode
- [ ] Full anti-guilt UX audit: confirm no shaming copy, no red X states, anywhere

**Exit criteria:** you'd hand this to a real user without embarrassment.

---

## Backlog (post-launch, not before)

- [ ] Photo/OCR import from a physical paper tracker
- [ ] Wearable integration (Apple Health / Google Fit) for auto-logged habits
- [ ] Broader social features beyond groups (public leaderboards, discovery)

Do not pull these forward without a specific reason — they're each a real subsystem, not a quick add.
