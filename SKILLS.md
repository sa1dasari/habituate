# SKILLS.md — Build order for Habituate

Work through these phases in order. Don't start a phase until the previous one's exit criteria are met — this is a solo build and sequencing is what keeps it shippable. Check items off as you go; this file should reflect real progress, not the plan.

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

- [ ] Firebase Auth wired up (sign up, login, logout); backend verifies the Firebase ID token server-side on every request
  - **Not started.** `userId` is currently a `@RequestParam(defaultValue = "demo-user")` on every endpoint, so any caller can read or write any user's data. This must land before anything is deployed.
- [x] `habits` table + CRUD API (create, edit, archive, restore, permanent delete)
- [x] `check_ins` table + log/undo check-in API
- [ ] Cadence types (daily / weekly / monthly) stored and enforced in UI
  - Stored and used to group the Habits list; `cadenceTarget` is not yet enforced against check-in counts.
- [x] **Today page complete**: today's habits list using the shared habit card, check-in tap interaction, today's progress ring, non-punitive empty state
- [ ] **Habits page complete**: cadence-grouped habit list (Daily/Weekly/Monthly), add/edit habit flow, calendar grid view per habit (mirrors the paper tracker layout — days across, habits down)
  - Cadence grouping, the add-habit flow (with a category dropdown), and the edit / archive / restore / delete UI are done; the calendar grid is still pending.
- [ ] Streak calculation (current + longest) wired into the shared streak indicator component
  - Current streak is computed **client-side** in `useHabits.js`; longest streak isn't tracked at all. Both should move server-side.

**Exit criteria:** you can create a habit, check it in daily for a week, see a streak number, and see it on a grid — both Today and Habits pages fully match the mockups, not just functionally present.

---

## Phase 3 — Goals layer
**Goal:** weekly/monthly goals independent of a single habit. Folds into the Habits page rather than being its own tab.

- [ ] `goals` table + API
- [ ] Mobile: add a goal (habit-linked or freeform), progress bar
- [ ] End-of-period review screen (hit/missed, simple rollover option)

**Exit criteria:** a monthly goal like "10 days of gym" shows live progress against the linked habit's check-ins.

---

## Phase 4 — Event backbone
**Goal:** every check-in also becomes a Kafka event, nothing consumes it yet.

- [ ] `checkin-events` Kafka topic created
- [ ] API publishes to the topic on every check-in write, same request
- [ ] Basic consumer that just logs events, to confirm the pipe works

**Exit criteria:** checking in on mobile produces a visible event in the Kafka topic within your local setup.

---

## Phase 5 — Insights engine v1 (simple, batch) — Insights page complete
**Goal:** prove the insight concept before adding Flink complexity, and finish the Insights page end to end.

- [ ] Nightly job (plain scheduled task, no Flink yet) computes pairwise, directional correlation over the last 30 days per user (P(habit B completed | habit A completed))
- [ ] Minimum sample-size threshold enforced before a correlation is surfaced (don't show "90% match" from 3 data points)
- [ ] `correlations` and `insights` tables populated, including a generated nudge string per insight
- [ ] **Insights page complete**: consistency ring (Daily/Weekly/Monthly/Yearly tabs), "Pattern detected" cards using the shared insight card component (directional label, match %, one-sentence non-causal description, evidence-based nudge)

**Exit criteria:** after a couple weeks of check-in data, the app surfaces at least one correct, sensible correlation with the full card treatment, and the Insights page fully matches the mockup — not just the underlying data being correct.

---

## Phase 6 — Insights engine v2 (real-time, Flink)
**Goal:** replace the nightly batch job with the real-time pipeline. No new UI — this phase upgrades what's already on the Insights page.

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
**Goal:** the things that make people keep using it daily.

- [ ] Home-screen widget for quick check-in
- [ ] Push reminder scheduling per habit
- [ ] Data export (CSV/JSON)
- [ ] Dark mode
- [ ] Full anti-guilt UX audit: confirm no shaming copy, no red X states, no causal-language leaks in correlation copy, anywhere

**Exit criteria:** you'd hand this to a real user without embarrassment.

---

## Backlog (post-launch, not before)

- [ ] Photo/OCR import from a physical paper tracker
- [ ] Wearable integration (Apple Health / Google Fit) for auto-logged habits
- [ ] Broader social features beyond groups (public leaderboards, discovery)

Do not pull these forward without a specific reason — they're each a real subsystem, not a quick add.
