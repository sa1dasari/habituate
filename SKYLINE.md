# SKYLINE.md

The active build plan for rebuilding Habituate's UI as a skyline. Read the section for the current phase, not the whole file. `CLAUDE.md` holds the standing rules. This file holds the spec, the phases and the open decisions. Tick items as they are verified and write what was actually checked.

## 1. Goal and final decisions

Replace the list-and-ring UI with a skyline. Each habit is a tower. Each check-in is a floor. Keep the backend, the data model, the hooks and the product rules. No Classic toggle.

Decisions already made by the owner:
- The Skyline is the home screen. One tower per habit, one floor per check-in.
- Check-in is a hold of about 1 second. A "Tap to build" setting under Accessibility is the fallback.
- A daily-cadence tower may top out once it's old enough — default 30 days, user-configurable per habit at creation or edit (revised 2026-11-10, `SKYLINE-ADDENDUM.md` decision 2; was a fixed ~60 days). The old tower is finished and no longer under construction, and a new tower starts for the same habit. Weekly/monthly-target habits never top out — see the next bullet.
- Revised 2026-11-10 (`SKYLINE-ADDENDUM.md`): the Skyline tab has two views behind a segmented switch, not one — **Daily** (towers, as originally designed) and **Weekly and monthly** (lots: houses-on-pads for a weekly target, nested rings for a monthly target >1, a single pad for a monthly target of 1). It is not a fifth tab. A habit lives in whichever view matches its cadence. See section 4a.
- Retired (archived) habits stay as grey monuments (daily view) or a grey "Retired" list (weekly/monthly view — they don't top out or monument the same way).
- The sky follows the user's local time and weather.
- Existing models are reused. Terminology and form layouts change.
- The Habits tab is removed. Today is renamed Skyline.
- Four tabs: Skyline, Insights, Community, Profile.
- The old 2D rings and tree-ring chart are removed.
- Ask Habituate is removed from the Insights tab. The chat icon on the Skyline screen stays.
- Skia is allowed if `react-native-svg` is too slow, and that needs an EAS build.
- The old phases in `SKILLS.md` are history. The phases below replace them.

## 2. Screen inventory

The 15 mockups live in `design/skyline/` (export the canvas boards as PNGs, one per screen). All are dark mode with sample data. They show intent, not final pixels.

| # | Mockup | Replaces | Behavior |
|---|---|---|---|
| 1 | Main (Skyline) | `TodayScreen` | Sky, towers left to right, an empty lot at the end, header with chat icon and profile icon, bottom sheet list of today's towers |
| 2 | Hold | check-in tap on a Today row | Press and hold the tower top about 1s, ring fills, floor lands, haptic. Release early cancels with no penalty |
| 3 | TowerSheet | habit detail and edit in `HabitsScreen` | Tap a tower: stats, current run, best run, schedule, edit, Shield Day, Retire, Top out, contextual Ask Habituate |
| 4 | TopOut | habit complete flow (new) | Confirm dialog, gold cap and flag animation, new tower starts, run carries over |
| 5 | SkyStates | Today background (new) | Dawn, day, overcast, rain, snow, night |
| 6 | Insights | `InsightsScreen` | Rings removed. Skyline-based summaries. Coach card removed. Goals list goes at the bottom (section 14) |
| 7 | CrossSection | per-habit history (`TreeRingChart`, calendar) | Inside view of one tower: each floor is a day, glass floors are Shield Days, open floors are soft outlines |
| 8 | Community | `CommunityScreen` | Friends, friend skylines, shared habits, challenges, activity feed |
| 9 | Challenges | challenges list | Landmarks list and discovery |
| 10 | SharedHabit | shared habit detail | Member towers joined by a skybridge |
| 11 | Challenge | challenge detail | One landmark tower, floors colored by contributor |
| 12 | NewTower | habit form in `HabitsScreen` | "Lay a foundation" |
| 13 | NewShared | `CreateGroupModal` | "Build together" |
| 14 | NewChallenge | `CreateChallengeModal` | "Raise a landmark" |
| 15 | Profile | `ProfileScreen` | Same content, restyled |

Not drawn yet, to be drawn before their phase starts: friend skyline (Phase 6), first-run empty-lot screens (Phase 7), notification explainer (Phase 7), light mode (Phase 1).

## 3. Terminology

Copy only. Code keeps its names. The full table is in `CLAUDE.md` section 1. Put all user-facing strings for the skyline in `constants/skylineCopy.js` so they can be reviewed in one place.

## 4. Floor and streak states

One floor per calendar day in the user's timezone (use the existing `X-Timezone` day bucketing).

| State | Meaning | Look |
|---|---|---|
| set, in run band | check-in done that day, inside the current streak | solid face in the category color, lit windows |
| set, past run | check-in done that day, streak has since moved past it | solid face in the category color, dark/unlit windows |
| open | no check-in, no penalty | a dark void block with a thin outline — not a see-through dashed outline |
| glass | Shield Day used | a flat, distinct-colored block, no windows at all — never the category color. Storage resolved 2026-11-10 (`SKYLINE-ADDENDUM.md` decision 5): a new table/column records the specific shielded date (daily view) or period (weekly/monthly view) directly; `shield_awards` stays as award-history only. Not yet built. |
| not due | habit not scheduled that day | no floor drawn, tower does not grow |
| ledge | best run | a thin white ledge at the top of that run |

Windows (revised 2026-11-09, `concept_screens/tower_floor_states_windows_and_shield.png`): every real check-in draws windows — the number is a per-device Accessibility setting (`hooks/useWindowCount.js`, default 3), never fewer than 1. Lit vs. dark is the only thing that changes with run-band membership; the wall color itself is identical either way. A Shield Day floor never has windows at all — their presence/absence is the primary non-color signal (section 13), not the color itself.

Rules:
- Floors are never removed and the tower never shrinks.
- Not-due days (weekly or monthly cadence) add no floor and no open outline. Use `habitPeriodHistory` in `utils/consistency.js` for cadence-aware logic. Do not recompute streaks in the scene builder. Take them from `utils/streaks` or the existing hook output.
- Quantitative (COUNT) habits, revised 2026-11-10 (`SKYLINE-ADDENDUM.md` section 3, replacing the "no partial floors in v1" rule): the day's floor fills to the logged fraction and keeps that fill level forever, even once the day is over — it does not snap to fully "open" or fully "set". The run only moves forward once the day's target is actually met. The habit row shows the real numbers ("5 of 8 glasses today"). Not yet implemented — `utils/skylineScene.js`'s `faceShapes` currently only draws binary open/set/glass; a partial-fill face variant is new work for the phase that picks this up.
- Shared habits: the skybridge between member towers is solid when the group streak is safe, flickers amber when at risk, and turns glass when frozen. Never red.
- Challenges: one landmark tower. Each floor is colored by the contributor.

## 4a. Weekly and monthly view: lots

Added 2026-11-10 from `SKYLINE-ADDENDUM.md` (full detail there until it's merged in and the file deleted — see the note at the top of that file). A habit with a weekly or monthly target lives here instead of the Daily towers view; a segmented switch at the top of the Skyline tab picks the view (not a fifth tab), remembers the last choice, and shows a small count on the inactive view's label when it has something open today.

Each habit is a row: name + cadence ("Gym, 3 a week"), then a horizontal strip of lots scrolling back through history, newest on the right. A lot is a rounded square, 76dp on the main view.

- **Weekly target**: one lot per week, holding small pads (up to 7) — each check-in puts a house on the next pad. Unbuilt pads in the current week are dashed previews. Houses never disappear once built; a week that came up short just keeps fewer houses, dark windows, no "missed" label. Windows are lit only while that week is part of the current run of consecutive met weeks. Extra check-ins past target add houses (a number past 7). A shielded week is one plain solid block. Caption is plain text: "3/3", "2/3", "1/3 now".
- **Monthly target above 1**: one lot per month, nested rounded-square rings — one ring per week-block (day blocks 1-7/8-14/15-21/22-28/29-end, resolved 2026-11-10 decision 1; gives 4 rings in February, 5 otherwise), week 1 in the middle. Ring shade follows that week's check-in count (0/1/2/3+ as four brightness steps, not hue alone). Target met for the month gives the lot an amber border; under target gets nothing extra, no red, no label. A shielded month is one plain solid block. No windows on rings — the month run is shown as row text ("3 month run").
- **Monthly target of 1**: a single pad per month, no rings — same rules as a weekly pad.
- **Count habits with a period total** ("100 pages a week"): same lot shapes, each logging is one house/ring step, shade follows share of pace needed, caption shows the real total ("62 of 100 pages").

Checking in: hold the current lot (≥44dp target) or the same hold-pill already used on daily rows — same ring fill, haptics, Tap to build setting, screen-reader action. "Add for another day" (a link on the row) backdates into the last 7 days, even across a period boundary (resolved 2026-11-10 decision 4) — **no new backend work needed**, confirmed 2026-11-10: `HabitService.java` already accepts and validates a client-supplied `occurredAt` for any BOOLEAN/COUNT habit regardless of cadence, and `components/CalendarModal.js` already has a working day-detail panel (`onToggleHabitDay`) that backdates/undoes any past day up to today. One check-in per calendar day for BOOLEAN habits (any cadence) is already enforced server-side (`DuplicateCheckInException`, keyed on `trackingMode`, not `cadenceType`) — confirmed 2026-11-10, no change needed (decision 3). COUNT habits already allow unlimited check-ins per day, which a period-total habit needs.

Undo: tapping a lot opens a sheet listing that period's check-ins with dates, each removable. The backend `DELETE /api/check-ins/{id}` endpoint this needs already exists and is already used elsewhere (`removeLastCheckIn`) — confirmed 2026-11-10 — but no client UI today lets a user browse a period's check-ins and delete an arbitrary one (today's only undo is "remove the single most recent check-in for today"). The lot sheet's list-and-delete view is new client UI only, no backend change.

Confirmed gap, logged 2026-11-10 (not solved, flagged for whichever phase picks up shared habits/challenges with non-daily cadence): `GroupStreakEngine.java` is purely day-by-day (`qualifiesToday`, `previousLastQualifyingDate`, one increment per calendar day) — it has no concept of a week or month. A shared habit or challenge with a weekly/monthly target cannot have its group streak computed by the existing engine as-is; that's backend work, not a client view, and isn't scoped into any phase yet.

New pure builder, not yet written: `utils/lots.js`, `buildLots(habit, checkIns, options)` — same purity rules as `buildScene` (no React, no I/O, no clock reads, caller passes `today`; reuses `habitPeriodHistory` in `utils/consistency.js` for period bucketing rather than a second streak calculator). New components, not yet written: `components/LotsView.js`, `components/LotTile.js`, budget ~300 shapes on screen. `SkylineScreen` gains the view switch; the habit row and hold-handling stay shared with the daily view.

Weekly/monthly habits retire to a grey "Retired" list under the view, not a monument — they never top out.

## 5. First-run flow

Goal: the user builds their first floor within 60 seconds of choosing a username.

1. Splash and auth (existing Firebase flows, unchanged).
2. Username (existing).
3. Empty skyline: a few empty lots. Tapping a lot opens "Lay a foundation" with the 6 templates from `TemplateHabitsPicker` as the first choices. Custom is the last option.
4. After the foundation, the user holds the tower for the first floor. The hold gesture is taught here with a one-line hint and a ring that fills.
5. After the first floor lands, show the notification permission explainer, then the system prompt.
6. After the first floor, ask once for approximate location with a plain explainer ("so your sky matches your weather"). Skip is a single tap. Never ask again unless the user opens the setting.
7. A short skippable tour of about 5 steps replaces the 15-step `onboardingTour`. Steps: the skyline, hold to build, the tower sheet, Community, Profile.

## 6. Tower lifecycle and data

States: active (crane on top), topped out (gold cap and flag), monument (grey, retired), empty lot (plus sign).

Top out (daily-cadence towers only, revised 2026-11-10 — weekly/monthly habits never top out, see section 4a):
- Offered when a tower is old enough — default 30 days, confirmed 2026-11-10 (`SKYLINE-ADDENDUM.md` decision 2). This is now a per-habit setting, not a fixed global rule: the habit form needs a top-out-threshold field (editable at creation or edit time), which is new scope not in the original section 10 form mapping. The offer itself is a button in the tower sheet. It is never automatic and never nagging.
- Topping out does not reset the run, shields, group membership or widgets. The habit keeps one row.
- Data model, CONFIRMED by the owner 2026-11-10 (`SKYLINE-ADDENDUM.md` decision 6): keep one `Habit` row and add a `habit_towers` table with `id`, `habit_id`, `user_id`, `started_at`, `topped_out_at` (nullable), `best_run_in_segment`. The active segment has no `topped_out_at`. Check-ins are not duplicated. A segment owns the check-ins whose `occurredAt` falls between its start and end. The per-habit top-out threshold lives on the `Habit` row itself, not per-segment.
- Add the entity, repository, service methods and a `POST /api/habits/{id}/top-out` endpoint with ownership checks and tests. `ddl-auto=update` creates the table. Backfill one open segment per existing habit lazily on first read, not in a migration.
- Fuller result spec, confirmed 2026-11-10 (`SKYLINE-ADDENDUM.md` section 3): topping out gives the old tower a gold cap and flag, drops it to about 40% opacity, and keeps it visible — show at most the latest two faded towers behind a habit's current one; older ones fold into a count on the tower sheet ("3 earlier towers"). See the compositing note below.
- Visual, captured 2026-11-09 (`concept_screens/topped_out_tower_fades_behind_new_tower.png`), refined 2026-11-10 with the ~40%-opacity/two-tower-max detail above: a topped-out segment and its active successor share one horizontal slot, not two — the old tower renders behind, desaturated (muted brown, not the vivid category color) and at ~40% opacity, with all-dark windows per section 4's window rule, offset back-left; the new tower renders in front at full opacity and category color, offset forward-right, with its own crane. The two overlap at the base. This is a compositing change to `SkylineTower`/`buildScene` (up to three tower renders per habit slot — two faded plus the active one — instead of one) — not attempted in Phase 2, since Phase 2's adapter has no segment data yet (every habit renders as a single `active` tower).

Retire:
- Retire is the existing archive. A retired habit shows as a grey monument at its final height. It no longer takes check-ins.
- Restore (unarchive) stays available from the monument's sheet if the existing app already offers it. Check the code.

## 7. Sky and weather

Sky kinds: dawn, day, overcast, rain, snow, night.

- Time windows come from local time and, when location is known, sunrise and sunset. Without location, use fixed windows: dawn 5 to 8, day 8 to 18, dusk folded into night 18 to 5. Define them in `utils/sky.js`.
- Weather code maps to a kind: clear to the time-based sky, cloud to overcast, rain or drizzle or thunder to rain, snow or sleet to snow. Fog maps to overcast.
- Refresh at most every 30 minutes while the app is foregrounded, plus once on launch. Cache the last result. Offline or no permission falls back to the clock.
- Location is approximate only (coarse permission, rounded to about 1 km before use). Stored only on the device unless the weather provider decision in section 14 needs the backend.
- Respect Reduce Motion: no drifting clouds or falling rain animation, show a static sky.
- `utils/sky.js` is pure: `skyKind({ now, sunrise, sunset, weatherCode })`. Easy to test.

## 8. Scene engine

`utils/skylineScene.js` exports `buildScene(habits, options)`. It returns plain data. No React, no I/O, no dates read from the clock. The caller passes `today`.

Input per habit: id, name, category, color, check-in days (set of day strings), shield days, due-day rule, current run length, best run (start and end), state (active, topped out, monument), start date. Options: width, today, reduceMotion, theme.

Output: a flat list of shapes `{ id, kind, points|d, fill, stroke, opacity, towerId, floorIndex }` plus a hit-test list (tower id with bounding box) and per-tower accessibility labels.

Projection and geometry (from the mockups, viewBox 390 by 560):
- Base line y = 500. First tower x0 = 14. Step between towers = 52.
- Tower width 36. Oblique offset dx = 10, dy = -6 (right face and top face).
- Floor height 10. Crane mast about 38 px with a short jib. Flag on topped-out towers.
- When there are more towers than fit, the skyline scrolls horizontally. Keep the step constant and scroll, never shrink.
- A tower draws at most about 60 floors. Older floors collapse into tiers (a taller floor block with a thin tier line). Budget about 600 polygons on screen. Merge faces by color into few `Path` elements.

Colors: use `categoryColor` with a checked light and dark variant. Reference dark values from the mockups: Run #FF8A5B, Read #4FC3E0, Write #F2C14E, Sleep #A98BFF, Water #5BD6A4, Mono #7B8793. Dark UI: BG #0F1216, SURF #161B21, SURF2 #1E252D, text #F2F4F6, muted #A3ADB8, amber #F2C14E. Derive the light palette in Phase 1 and check contrast (WCAG AA for text, 3:1 for tower faces against the sky).

Gesture: a long press recognizer on the tower hit area (react-native-gesture-handler). Hold about 1000 ms. Fill a ring with Reanimated. Haptic on start (light) and on complete (success). Cancel on release or move beyond a small slop. Tap opens the tower sheet. With "Tap to build" on, a tap builds the floor and a long press opens the sheet. A tower already built today ignores holds and shows a "built today" state.

Render: `react-native-svg` first. Only the floor that just landed animates. Everything else is static and memoized by tower. Measure before deciding on Skia (Phase 0).

## 9. Data and API

Early phases need no backend change. The client already loads `listCheckIns` per habit and computes streaks.

- Phase 3 adds the `habit_towers` model and top-out endpoint (section 6).
- Phase 5 or 6 may add an aggregate endpoint so the skyline loads with one call instead of one `listCheckIns` per habit. Measure first. Only add it if the home screen load is slow with 10 or more habits.
- Phase 6 adds a friendship-gated friend skyline endpoint. It returns completion flags per day and tower metadata only. No values, no notes, no "why". It respects profile visibility (PRIVATE by default) and the shared habit detail visibility setting (Full or Status only).
- Shield Days: today they are a manual toggle and `shield_awards` records awards only. How a shielded day is stored per date is an open decision (section 14). The glass floor needs a per-date answer.

## 10. Form mapping

Reuse every existing field. Change layout and labels only.

Lay a foundation (habit): name, category (14), check-in mode (Check-off or Quantitative), cadence with per-day, per-week or per-month targets, ideal time, optional "why", reminder, pinned goal. Revised 2026-11-10 (`SKYLINE-ADDENDUM.md` section 6, 7): cadence is asked early, since it decides which preview shape to show — a tower for daily, a lot for weekly/monthly, both in the category color. A daily-cadence habit also gets a top-out-threshold field (days, default 30, section 6) — new field, not in the original mapping. Changing cadence later (edit form) moves the habit between the Daily and Weekly/monthly views; past check-ins are kept and regrouped into the new view's periods, never deleted.

Build together (shared habit): name, goal type (Unified or Split), streak type (Cooperative or Independent), streak rule (Any or All members), skip days per month (0 to 3), detail visibility (Full or Status only), invitees. Explain streak rule in one plain sentence under the control.

Raise a landmark (challenge): name, description, tracking (Check-off or Count), target count, frequency (Daily, Weekly quota or Custom days), duration (1 week to 1 year), visibility (Private or Public), invitees.

Keep all existing validation and error messages. Errors show `err.message` through `useToast`.

## 11. Phases

One phase at a time. Do not start a phase until the gate of the previous one is met and the owner says go. Each phase ends with the `CLAUDE.md` section 5 checks, the advisory review loop if it was a major build, and ticked items below.

Revised 2026-11-10 (`SKYLINE-ADDENDUM.md` section 8) — not yet applied to the checklists below, recorded here as the plan: Phase 0 should also have drawn mockups for the Weekly/monthly view, the lot sheet, "Add for another day," and the faded-top-out result (not done — Phase 0 already closed before the addendum landed; catch up before Phase 2b starts). A new **Phase 2b** (Weekly and monthly view) is inserted after Phase 2 — see below. Phase 3's top-out scope narrows to daily towers only, with the faded-old-tower compositing. Phase 4's forms ask cadence first. Phase 6 waits on the `GroupStreakEngine` gap (section 4a) before promising shared/challenge support for non-daily cadence.

### Phase 0: spike and lock
- [x] Run `npx expo-doctor` and write the result here. 2026-11-06: 19/21 checks passed. 2 failures, neither a blocker: (1) `react-native-shared-group-preferences` flagged untested-on-New-Arch / unmaintained — pre-existing, unrelated to the skyline rebuild; (2) 9 packages one patch version behind the SDK 57 baseline (expo, expo-constants, expo-dev-client, expo-image-manipulator, expo-image-picker, expo-notifications, expo-sharing, expo-splash-screen, expo-updates) — cosmetic drift, not attempted to fix here since it's outside this task's scope. No worklets/gesture-handler issues reported.
- [x] Spike: render 10 towers with 30 floors each plus a sky in `react-native-svg`. Measure frame time on a mid-range Android device and an older iPhone while scrolling and while one floor animates. Target: steady 60 fps, no frame over 24 ms. Write numbers here. 2026-11-06, measured on the owner's Android device (`R3CW30FLR7H`) via `adb shell dumpsys gfxinfo com.habituate.mobile [reset|framestats]`, scrolling the horizontal skyline and tapping "Animate floor" for both harness modes (naive ~900 path elements, merged ~30 path elements matching the section 4/8 budget):
  - **Scroll, naive mode**: 367 frames, 2.45% janky, 90th pct 8ms, 95th pct 15ms, 99th pct 53ms.
  - **Scroll, merged mode**: 338 frames, 0.89% janky, 90th pct 8ms, 95th pct 9ms, 99th pct 17ms — comfortably under the 24ms target.
  - **Animate floor, naive mode**: 50th pct 36ms, 90th pct 48ms, 95th pct 53ms — well over target.
  - **Animate floor, merged mode**: 50th pct 36ms, 90th pct 53ms, 95th pct 53ms — same jank as naive. Retested after removing a `key`-driven remount from the harness (the first pass drove the animation by remounting the whole animated subtree per tap, which could have been inflating the numbers); the retest shows the same 36ms median, so the jank is not a remount artifact.
  - **Reading**: the static scene (the bulk of real usage — scrolling an already-built skyline) hits the target cleanly under the merged-path budget strategy the engine is supposed to use. Only the single-floor-landing animation is slow, and it is slow by the same amount regardless of background polygon count — that points at the animation mechanism itself (an SVG `<G>` driven by Reanimated `useAnimatedProps`/opacity) as the cost center, not at `react-native-svg`'s general rendering capacity. This is not conclusive evidence that Skia is needed: Phase 1 should first try a cheaper animation approach for the landing floor (e.g. a plain `Animated`/native-driver transform on a wrapping layer, or a simpler one-shot opacity tween without a `G` wrapper) before reaching for a renderer change.
  - iPhone: not available this session, not measured.
- [ ] If the floor-landing animation is still over target after Phase 1 tries a cheaper animation mechanism, repeat with `@shopify/react-native-skia` and ask before adding it (EAS build needed).
- [x] Export the 15 mockups to `design/skyline/` as PNGs. 2026-11-06: copied from `concept _screens/` (not moved — that folder stays as-is) and numbered to match the section 2 inventory table: 01-skyline, 02-hold, 03-towersheet, 04-topout, 05-skystates, 06-insights, 07-crosssection, 08-community, 09-challenges, 10-sharedhabit, 11-challenge, 12-newtower, 13-newshared, 14-newchallenge, 15-profile.
- [x] Write the parity checklist (section 12). 2026-11-06: written from grepping each file's interactive elements (`onPress`/`onValueChange`/navigation calls), not yet read line-by-line in full and not yet ticked against any new screen — that happens as each replacement screen reaches parity in its phase.
- [x] Baseline: record current app launch time and Today load time with 10 habits, so the rebuild can be compared. 2026-11-07, measured on the owner's Android device via the dev client (temporary `console.log(Date.now())` markers added at the top of `App.js` and right after `setHabits`/`setArchivedHabits`/`setShieldsAvailable` succeed in `hooks/useHabits.js`, removed again once read):
  - **JS start → Today's habit list loaded**: 1695ms, with 13 habits (owner added a couple more than the 10 target while padding for this measurement — close enough, not re-measured for an exact 10). This is the comparable number to track against through the rebuild: JS module evaluation to `HabitsProvider`'s first successful `listHabits`/`listArchivedHabits`/`getShields` fetch landing, over the real network to the Railway production API.
  - **Cold native process start → Expo dev-launcher screen visible**: ~1.2–1.6s (`adb shell am start -W`, two runs: 1570ms and 1211ms `TotalTime`). Not a usable baseline on its own — the dev-launcher screen is a dev-client-only step (picking a development server) that does not exist in a release build, so it would overstate a production cold start. Recorded for completeness, not for the "15% slower" acceptance check in section 13, which should use the 1695ms JS-to-loaded figure once a release-build equivalent is measured.
  - No iPhone available this session — Android only, per the renderer spike note above.
- Gate: renderer chosen — `react-native-svg`, based on the scroll/static-scene numbers above comfortably hitting target under the merged-path budget. The one open item is the floor-landing animation mechanism (not the renderer), to be fixed in Phase 1 before deciding whether Skia is needed at all. Numbers written down. Parity checklist written. Baseline recorded (Android only; iPhone not available). Owner go: given 2026-11-07.

### Phase 1: engine and palettes
- [x] `utils/skylineScene.js` with `buildScene`, plus fixtures and tests. 2026-11-08/09: pure scene builder implemented per section 8 — does not recompute streaks or due-days (reuses `hasDailyTarget` from `utils/cadence.js`; `currentRun`/`bestRun` are caller-supplied inputs). Shapes grouped one `<Path>` per (tower × face × floor-state) rather than one merged path per tower per the Phase 0 spike's simplification, since set/open/glass/run-band floors need different fills/strokes — still ~120 shapes for 10 towers, far under the naive-900 case that was janky in Phase 0. All six floor/lifecycle states implemented: set, open (dashed outline), glass (fill + diagonal hatch), not-due (no shape, implicit omission), run band (lightened fill + a pair of "window light" squares per floor, matching the two-window pattern in `design/skyline/01-skyline.png` and `03-towersheet.png` — a shape signal, not color alone; initially shipped as a single window, corrected after comparing against the mockups), best-run ledge (white/dark line), tower collapsing into one tier block past ~59 due days (with a tier line), and three lifecycle markers: crane (active), flag (topped out), grey overlay **plus diagonal cross-hatch** (monument — the hatch was added after self-review caught that the overlay alone was a color-only signal, failing section 13's grayscale-readable requirement). Fixed a real date-parsing bug caught by the test suite: `habit.startDate`/`bestRun.endDate` are 'YYYY-MM-DD' strings per the section 8 input spec, but were being round-tripped through `new Date()`, which parses a bare date-only string as UTC midnight and lands on the previous local day on a negative-UTC-offset machine — fixed to treat them as already-canonical strings, no `Date` round-trip.
- [x] `utils/sky.js` with `skyKind`. 2026-11-08: pure, fixed time windows (dawn 5-8, day 8-18, night otherwise) with an optional sunrise/sunset override; weather code is a loose provider-agnostic string match (rain/snow/overcast), never overrides night. Location/weather wiring is Phase 2.
- [x] Light and dark tower and sky palettes in `theme.js`, contrast checked. 2026-11-08: added as new exports (`skylineUI`, `skylineTowerTheme`, `skyGradients`) — existing `lightColors`/`darkColors`/`categoryColor` untouched. Contrast checked programmatically (WCAG formula): all text/muted/amber pairs pass AA (4.78–17.03:1). Two of the 14 per-category dark tower colors (Home, Digital Wellbeing) measured under the 3:1 tower-vs-sky target (2.23, 2.08) and were brightened for the dark variant only (`DARK_TOWER_BRIGHTEN` in `theme.js`) to clear 3:1; their app-wide icon-tile color is untouched. Light mode is a first draft per section 14 decision 7, not yet owner-reviewed against a final render (the Phase 1 dev screen render was shown and looked right, but that's not the same as a sign-off).
- [x] Per-category light and dark variants. 2026-11-08: `buildCategoryTowerColors()` in `theme.js` derives both from the existing `HABIT_CATEGORY_COLORS` hue (dark ≈ as-is, light ≈ -40 shaded) rather than a hand-picked second list, so a tower matches its habit's icon tile elsewhere in the app.
- [x] `components/SkylineTower.js`, `SkylineView.js`, `SkyBackdrop.js`. 2026-11-08: `SkylineTower` is memoized per tower (shape-array reference equality). `SkylineView` composes a fixed (non-scrolling) `SkyBackdrop` behind a horizontally scrolling `Svg` of towers, plus absolutely-positioned `Pressable` overlays per tower (44dp-minimum hit target, accessibility label wired) — `onTowerPress` is accepted but unwired, Phase 2 connects it to the tower sheet.
- Gate: a dev-only screen (`screens/dev/SkylineEngineScreen.js`, replacing the Phase 0 spike tab) renders the fixture skyline in both light and dark, across all 6 sky kinds, checked on-device (Android) 2026-11-08/09 — all floor/lifecycle states visually confirmed distinct in both modes. Not verified: iPhone (none available), actual on-screen frame time with this real shape count (Phase 0's spike numbers are the standing evidence; Phase 2 is the next point real interaction/animation gets measured). Two advisory-review subagents (mobile lens, product lens) were spawned per the working agreement but both failed on a weekly API limit before producing output — the review was done directly instead (self-review caught the two issues fixed above: the run-band state was silently unimplemented, and monument relied on a color-only signal).

### Phase 2: Skyline home, hold, sky
- [x] New Skyline screen in a new file, wired to the existing hooks. `screens/SkylineScreen.js`, uses `useHabits` directly, 2026-11-10.
- [x] Hold-to-build and Tap-to-build setting (Accessibility settings). Verified on-device 2026-11-10: hold builds a floor with the "pours in" animation (replaced an earlier ring design per live feedback), BOOLEAN habits correctly blocked from a second hold once checked in today (undo-free, the gate's main correctness requirement), COUNT habits allow repeat holds. `hooks/useTapToBuild.js` setting wired into `AccessibilityScreen.js`.
- [~] Screen-reader action to build a floor and tower labels are wired (`SkylineHoldLayer.js`'s `accessibilityActions`/`onAccessibilityAction`, `buildScene`'s per-tower labels), and the bottom sheet full-list alternative is now built (`components/SkylineHabitSheet.js` — name, run length, a Hold/Built pill per row using the same gesture as the tower, via the new shared `hooks/useHoldGesture.js`). Verified on-device 2026-11-11 against `concept_screens/1-skyline-daily.png` — header, tower name labels, and the bottom sheet all match. Not yet device-tested with TalkBack/VoiceOver specifically.
- [x] Sky from the clock, plus weather and `expo-location` — approved and built 2026-11-10. Verified end-to-end on-device: real coordinates (rounded to ~1km), real sunrise/sunset, real weather code cached and correctly feeding `skyKind`. Required one EAS dev-client rebuild (done). The one-time plain-language explainer (`LocationPermissionModal.js`) fires after a successful first build, not on mount, confirmed on-device.
- [x] Empty-lot marker (a dashed "+ New" square after the last tower, `SkylineView.js`) opens the same template-habit quick-add flow `TodayScreen.js`'s empty state already uses (`TemplateHabitsPicker`, sensible defaults). Verified on-device 2026-11-11. "Empty state with lots" (the full first-run empty-skyline state, section 5) is separate, still Phase 7 scope.
- [ ] Tab renamed Skyline in `App.js`. Deliberately not done — Shield Day toggle and streak repair live in the Phase 3 tower sheet, which doesn't exist yet; renaming now would lose capability versus `TodayScreen`. Still reachable only via the `__DEV__` "Skyline2" tab.
- [x] Visual-fidelity pass against `concept_screens/1-skyline-daily.png`, 2026-11-11: tower name labels wrap to 2 lines instead of overlapping (`SkylineView.js`); an open floor is now a transparent cutout (`fill: 'none'` + visible outline) so the sky shows through instead of a solid dark void — resolves CLAUDE.md's "no hole, no dark gap" rule by keeping the floor's outline and height fully present and only its fill missing, per the owner's "hole cut out, blending with the background" direction; `SkyBackdrop.js` now paints a weather glyph (sun w/ rays, clouds, static rain streaks, static snow, or a real-phase moon + star field) on top of the gradient, all static per the existing "no drifting clouds/rain, static sky" rule (new pure `utils/moonPhase.js`, no eclipse/"blood moon" support — out of scope, needs real ephemeris data); `containerWidth` is no longer hardcoded to 390 anywhere (`useWindowDimensions()` in both `SkylineScreen.js` and the dev engine screen), closing the dead gap on wider phones; the habit sheet is now a draggable card (`SkylineHabitSheet.js`, Reanimated + Gesture Handler pan on the 44dp handle, collapsed peek ↔ ~55%-of-stage expanded, with an accessibility toggle) instead of locked to the bottom. Jest (34/34), `tsc --noEmit`, and `expo export --platform web` all clean. Not yet verified on an actual device/screenshot this round — moon-phase math is unit-tested (`utils/moonPhase.test.js`) but its on-screen rendering, the sheet's drag feel, and the open-floor's three-face wireframe look haven't been eyeballed yet.
- [x] Follow-up, 2026-11-11: the sky was still confined to the towers' box — moved `SkyBackdrop.js` to a full-page layer behind the header and everything else in `SkylineScreen.js` (`SkylineView.js` no longer renders its own backdrop), so the weather look spans the whole screen instead of stopping at a hard edge above the sheet. `SkyBackdrop.js`'s viewBox now matches the real device width/height 1:1 (icon/star positions are fractions of that box) instead of stretching a fixed 390x560 coordinate system, so the sun/moon stay circular at any aspect ratio. Added a translucent (55%) scrim behind the header text/icons so they stay legible over a sky that can now be anything from a bright day to a near-black night, instead of relying on the header always sitting on the flat theme background. The dev engine screen keeps its own confined preview box on purpose — it's comparing all 6 sky kinds side by side, not simulating the real page. Jest (34/34), `tsc`, and the web bundle all clean; not yet checked on-device.
- [x] Fix, 2026-11-11: on-device screenshot caught the last habit sheet row ("Go for a Run") visually chopped off right at the tab bar edge — `stage` (`SkylineScreen.js`) was missing `overflow: 'hidden'`, so the sheet's own intentionally-tall box bled past the stage's bottom edge and got covered by the (later-painted, opaque) tab bar instead of being cropped cleanly. Fixed by adding `overflow: 'hidden'` to `stage`. Also bumped the sheet's expanded coverage from 55% to 60% of the stage (`EXPANDED_RATIO` in `SkylineHabitSheet.js`) per the owner's request. **Confirmed fixed on-device 2026-11-11.**
- [x] Fix, 2026-11-11 (owner report): the sun/moon sat behind/too close to the header, and a tower old enough to approach the floor cap drew floors above the top of the scene. Root cause of the second one was arithmetic, not the cap logic — 59 floors × `FLOOR_H` (10px) = 590px, taller than `BASE_Y` (500px), so the old floors legitimately drew off the top; `MAX_INDIVIDUAL_FLOORS` dropped from 59 to 35, which fits comfortably under `BASE_Y` with headroom for the sky. For the icon, `SkyBackdrop.js` takes a new `iconY` prop; `SkylineScreen.js` now measures its header + view-switch block via `onLayout` (not a guessed fraction) and passes `insets.top + headerAreaHeight + 55` down, so the icon always sits clearly below the header regardless of device/safe-area height. Jest (48/48), `tsc`, web bundle all clean. **Confirmed on-device 2026-11-11**: moon renders clearly below the header on the Daily tab, towers no longer run off the top of the scene.
- [x] Rework, 2026-11-11 (owner replaced `concept _screens/2-weekly-monthly.png`, `3-lot-sheet-weekly.png`, `5-lot-sheet-monthly.png` with a different design): the houses-on-pads/nested-rings model from the first Phase 2b pass didn't match the new mockups, which show a per-calendar-day heatmap instead — a weekly tile is one row of the week's real 7 weekdays, a monthly tile chunks the month's real days into rows of 7 (same `Math.ceil(daysInMonth/7)` day-block boundary as before, now free from chunking a flat day list instead of a separate ring-block aggregate). `utils/lots.js`: every period now carries a `days` array (one cell per real calendar day, each with its own log count/level/isToday/isFuture) instead of `houses`/`ringLevels`/`overflow` — this also *removes* the old "monthly target of 1 is a special single pad" branch entirely, since every monthly period is the same day-grid regardless of target size. `components/LotTile.js`: one `DayGrid` renderer replaces `PadFace`/`RingsFace` — a dashed outline for a future day, a plain white outline for today, the existing amber tile border still means the whole period's target was met; added `LotLegend` (the static "None/1/2/3 or more, Target met/To come/Today" card under the tile list, per the mockup). `components/LotsView.js`: renders `LotLegend` once at the bottom, and adds a per-habit "Add for another day ›" link (new `onAddForAnotherDay` prop) — wired in `SkylineScreen.js` to a toast stub for now ("Pick a day to add a ... check-in — coming soon"), since the backdate/delete sheet behind it (`3-lot-sheet-weekly.png` / `5-lot-sheet-monthly.png`) is real, separate UI not built this round; tracked below. Also fixed, on an Opus advisor's review: a COUNT habit's current-period preview cells no longer extrapolate from the raw numeric `target` (a different unit than a day's log count — "100 pages a week" was implying "X days left" against a 100-unit target); COUNT periods only show real logged days now, no dashed preview. `utils/lots.test.js` rewritten for the `days` model (17 tests). Jest (51/51), `tsc --noEmit`, `expo export --platform web` all clean. **Confirmed on-device 2026-11-11** against real habit data: a COUNT monthly habit ("Job applications", 50/month) shows a day-grid tile per month with lit dots at the right positions and a dashed/white-outlined current-month preview; a BOOLEAN weekly habit ("Go to Gym", 3/week) shows per-weekday dots, an amber border on met weeks including an exceeded week ("4/3 — exceeded"), and the in-progress week correctly showing built + today + dashed-preview cells ("2/3 now"); the legend card renders at the bottom matching the mockup; "Add for another day" fires its stub toast ("Pick a day to add a Go for a Run check-in — coming soon").
- [x] "Add for another day" now opens the real lot sheet (`components/LotSheet.js`, new 2026-11-11/12): a day-grid picker (reuses `LotTile.js`'s `DayGrid`), a check-ins list grouped by date with per-entry Remove, "Hold to build" for the tapped day, prev/next arrows plus swipe left/right to move between periods, and a per-period chart above the list — a per-day bar chart for a COUNT habit, a cumulative-progress line against the target for a BOOLEAN habit (a flat barcode would've just restated the day-grid for a 0/1 day). See the dated notes below for the full build/fix history.
- Gate: a user can build a floor with a hold, undo-free, and the streak updates on the widgets. **Met and verified on-device 2026-11-10** for the hold/undo-free part; widget-update propagation itself wasn't separately re-checked this session (relies on `useHabits`' existing refresh → `syncHabitSnapshot` path, unchanged by this phase's work).
- Note added 2026-11-10: this phase's current code renders every habit as a tower via `utils/skylineAdapter.js`, with no view switch — weekly/monthly habits are not yet filtered into a separate view. That's Phase 2b's job, not a bug in what's already built.

### Phase 2b: Weekly and monthly view (new 2026-11-10, `SKYLINE-ADDENDUM.md`)
- [x] View switch (Daily / Weekly and monthly) on the Skyline screen, 2026-11-11: two segmented `Pressable`s above the stage in `SkylineScreen.js`, state in new `hooks/useSkylineView.js` (AsyncStorage, remembers last choice — not a Context, since only this one screen reads it, unlike `useTapToBuild.js`). Shows a count badge (amber, `lots.openToday` / `dailyOpenToday`) on the *inactive* view's segment when it has something open today. Switching views fully swaps the stage content (towers+sheet vs. `LotsView`) rather than overlaying one on the other — deliberate, so `SkylineHabitSheet`'s drag state always starts fresh instead of carrying a stale offset across a view switch that changes available height.
- [x] `utils/lots.js` (`buildLots`) with fixtures and tests, 2026-11-11: 14 tests covering a non-leap February (4 ring blocks) and a 31-day month (5 blocks) — generic `Math.ceil(daysInMonth/7)`, not month-number special-casing; a habit created mid-week/with older check-ins buckets cleanly; a shielded period; a COUNT habit (caption uses the summed value, houses/rings use the log-event count, not the value); run-band computation that doesn't let an unmet in-progress current period break the completed-period run before it (only extends the run when the current period is itself already met). Deliberately does NOT reuse `utils/consistency.js`'s `habitPeriodHistory` — that bucketer uses Mon-Sun calendar weeks for its month view (a different, pre-existing Insights feature), not section 4a decision 1's day-blocks; reusing it would silently change the ring count math.
- [x] `components/LotsView.js`, `components/LotTile.js`, 2026-11-11: originally houses-on-pads/nested-rings (see superseded detail below) — **reworked the same day** into the per-calendar-day heatmap described in the "Rework, 2026-11-11" note further down, once the owner replaced the concept screens. A plain solid block still renders for a shielded period (no texture, same signal as a Shield Day floor). New habit adapter `toLotHabit` in `utils/skylineAdapter.js` (lighter than `toSceneHabit` — buildLots buckets raw check-ins itself, no pre-classified day state needed). Shape count per tile is small; budget not separately measured against the ~300 ceiling since a realistic habit list is far under it.
- [x] Hold / Tap to build on the current lot, 2026-11-11: reuses `HoldPillButton` and the screen's existing `getCanBuild`/`onBuild` as-is — both already key off `habit.checkedInToday`, which the backend sets from any check-in today regardless of cadence, so no new plumbing was needed for a BOOLEAN weekly/monthly habit's undo-free same-day guard.
- [x] "Add for another day" (backdate) and the lot sheet (list a period's check-ins, delete one) — built 2026-11-11/12 across several rounds (see the dated notes below), reusing the existing backdate/delete endpoints confirmed 2026-11-10 (no backend change needed). Backdating reaches back to the habit's own `createdAt`, not just the last 7 days — `buildLots` sizes each habit's own period history from its creation date (capped at 2 years weekly / 3 years monthly), and a day before that is disabled the same way a future day already is.
- [x] Accessibility labels per lot, 2026-11-11: every `LotTile` (not just the current period) is `accessible` with a label matching the checklist's own example format ("Gym, week of Nov 3, 3 of 3, target met").
- [~] Light/dark day-cell shade ramp: the rings model's four opacity tiers (0.18/0.4/0.65/1) were superseded by the day-grid rework's own tiers (0/0.4/0.7/1, see `LEVEL_OPACITY` in `LotTile.js`) over the category color — not separately re-measured for contrast/grayscale distinguishability in either palette.
- Verification this round: `npx jest` (48/48, including the new `lots.test.js`), `tsc --noEmit` clean, `expo export --platform web` clean. **Verified on-device 2026-11-11** against real habit data (Android, Skyline2 dev tab): both views render, the switch correctly shows the open-count badge only on the *inactive* segment (confirmed both directions — Daily showed "0" badge-free with 4/4 built, Weekly & Monthly showed "3" while on Daily), a real weekly pad habit ("Go to Gym", 3/week) shows met weeks with an amber border and the current in-progress week as "2/3 now", a real monthly ringed habit ("Job applications", 50/month) shows 4 day-block rings with visibly different opacity tiers per month. Not separately exercised: the overflow "+N" badge (no real habit logged past 7 in one week) and TalkBack/VoiceOver on the new lot tiles.
- Lot sheet build, 2026-11-11/12 (several rounds): new `components/LotSheet.js` (day-grid picker, per-entry Remove, Hold pill for the tapped day), wired from `LotTile`'s new `onPress` and the row's "Add for another day" link (`LotsView.js`'s `onOpenSheet`). `utils/lots.js` gained `checkInsInPeriod` (the sheet's own check-ins list, derived from `period.days` bounds so it always matches the tile) and a `startDate`-aware history window (`historyWeeksFor`/`historyMonthsFor`, capped 2y/3y) so the sheet's prev/next navigation can reach a habit's full lifetime without the Weekly & Monthly tab's horizontal strip rendering that many tiles — the strip reads `row.recentPeriods` (a bounded suffix of the full `row.periods`), the sheet reads the full array. Jest/tsc/web bundle clean after every round; on-device verification included an incident report (a blind `adb input tap` briefly unchecked a real habit, caught and corrected, and a separate stray tap landed in the Claude mobile app instead of Habituate — no lasting data damage in either case, logged here as the reason later rounds switched to `uiautomator dump`-derived exact bounds for any state-mutating tap).
- Perf round, 2026-11-12: Hold-to-build showed no feedback until a full `listHabits`+per-habit-`listCheckIns` refresh completed, reading as "it didn't work" — fixed with an optimistic local patch in `useHabits.js` applied before the network call, `refresh()` reconciling after. Exposed and fixed three races the optimistic patch introduced: an out-of-order `refresh()` response could stomp a newer optimistic update (fixed with a sequence-numbered `refresh`), a failed action's error toast waited behind a full reconcile cycle (fixed by not awaiting the background reconcile before rethrowing), and a fake optimistic check-in id could reach the delete endpoint (guarded). The Daily/Weekly & Monthly tab-switch lag was *not* fixed by this round's `React.memo` additions — confirmed by the owner on-device — because the real cost was `SkylineScreen.js`'s `view === 'lots' ? A : B` ternary fully unmounting/rebuilding the inactive tab's tree on every switch; fixed separately by keeping both tabs mounted and toggling `display: 'none'` (which also removes the hidden tab from touch routing, so its hold gesture can't fire while hidden).
- Lot sheet polish round, 2026-11-12: bigger per-period chart (160px, full card width) with date-axis labels (every day for a week, thinned to ~6 plus today for a month) and value labels (count per bar, or the running total on the progress line); swipe left/right to change periods (in addition to the arrows); check-ins list grouped by date instead of a flat list; header/tab segmented-control spacing fixed (no gap existed before). Jest (58/58), `tsc --noEmit`, `expo export --platform web` all clean each round. **Not yet verified on-device** — the device's wireless ADB link dropped before this round could be checked; flagged to the owner, who will verify directly.
- Gate: a user can hold a lot to log a weekly/monthly habit, backdate into the last 7 days, and delete a wrong entry from a lot's sheet — all without leaving the Skyline tab. **Met**, and backdating now reaches further than the gate's original "last 7 days" — all the way to the habit's own creation date.

### Phase 3: tower sheet, inside view, top out (daily towers only)
- [x] Owner confirms the `habit_towers` model. 2026-11-10, as specified in section 6.
- [x] Backend segment entity, top-out endpoint, tests, 2026-11-12: new `habit_towers` table (`HabitTower`/`HabitTowerRepository`), `HabitTowerService` owning the segment lifecycle (lazy backfill of the first open segment at `habit.createdAt` — no batch migration; top-out closes the current segment, freezing its best run computed only from check-ins/shields inside that segment's own window, and opens a fresh one). `HabitService.topOutHabit` validates ownership and eligibility (daily-cadence only, age measured from the *current segment's own* start so a freshly-topped-out tower must earn its own age again) before delegating; `POST /habits/{id}/top-out`. `Habit.topOutThresholdDays` (int, default 30) added and wired into `UpdateHabitRequest`/`HabitResponse` — **not** added to `CreateHabitRequest` this round (13 existing positional call sites across the test suite use that record; the entity's own 30-day default covers creation-time behavior, and a client can still set a custom value via the same PUT right after creating). Threading a custom value through creation itself is deferred to Phase 4's form work, which is where the mobile create-form UI for this field lives anyway. `GET /habits/{habitId}/shielded-dates` returns every date (yyyy-MM-dd) a habit was shielded, personal-grace and repair sources both included with no distinction (CLAUDE.md).
  - The daily-cadence eligibility check can't just read `cadenceType` — mobile's real creation form (`HabitsScreen.js`'s `deriveCadenceType`) always sends `DAILY`, even for a period-only (weekly/monthly) habit, so `HabitService.hasDailyTarget` replicates mobile's `utils/cadence.js` predicate (targets + cadenceTarget, not just cadenceType) instead. One acknowledged, currently-unreachable gap: mobile's version also reads a client-only `dailyTargetExplicit` flag never sent to or stored by this backend — but since nothing today ever sends that flag `true`, the two predicates agree for every habit that can actually exist right now. Not a live bug; flagged so nobody "fixes" it without reason.
  - Mobile side: `api/client.js` gained `getShieldedDates`/`topOutHabit`, both callable — but deliberately **not** wired into `useHabits.js`'s `hydrate()`/global refresh cycle this round. Fetching shielded dates for every habit on every refresh would add an extra network round trip per habit on top of the one `listCheckIns` already costs, re-growing the exact refresh-lag problem fixed earlier this phase. `toSceneHabit`'s `shieldDays: []` stays a deliberate stub until Part D's inside view fetches a single habit's shielded dates on demand when it actually opens, not for the whole list on every poll.
  - Verification: `./mvnw -Dtest=HabitTowerServiceTest,HabitServiceTopOutTest test` (13/13), full `com.habituate.api.habits` package re-run (22/22 existing, unaffected), `./mvnw -q compile`/`test-compile` clean. Not run: the full suite (targeted only, per CLAUDE.md section 3), and no on-device/curl check of the live endpoints yet — Part C's tower sheet is what will exercise them end-to-end.
- [ ] Tower sheet with stats, edit, Shield Day, Retire, Top out, contextual Ask Habituate.
- [ ] Inside view (cross section) with set, open and glass floors.
- [ ] Top out confirm and animation. Old tower fades to ~40% opacity behind the new one (gold cap, flag); at most the latest two faded towers shown, older fold into a tower-sheet count. Monument state for retired habits (daily view only — weekly/monthly retire to a grey list, section 4a).
- Gate: top out keeps the run, the old tower fades behind at ~40% opacity with a gold cap, a new tower starts in front, group streaks and widgets unchanged.

### Phase 4: forms and Habits tab removal
- [ ] Lay a foundation, Build together, Raise a landmark forms with live previews. Cadence asked early (section 10); daily habits also get the top-out-threshold field.
- [ ] Every Habits screen action reachable from the Skyline (parity checklist all ticked for `HabitsScreen`).
- [ ] Habits tab removed from `App.js`. Four tabs live.
- Gate: no capability lost versus the old Habits tab.

### Phase 5: Insights
- [ ] Rings removed. Skyline-based summaries replace them (weekly floors, runs, shield use).
- [ ] Goals list placed per the decision in section 14.
- [ ] `TreeRingChart` no longer used.
- Gate: parity checklist ticked for `InsightsScreen`.

### Phase 6: Community
- [ ] Draw friend skyline first.
- [ ] Friends, friend skylines (friendship-gated endpoint), shared habits with skybridge, challenges as landmarks, activity feed, cheers.
- [ ] Notification center entry point per section 14.
- [ ] Shared habits/challenges with a weekly or monthly cadence (using the lots from section 4a) are blocked on a confirmed backend gap: `GroupStreakEngine.java` is purely day-by-day and cannot express a weekly/monthly period. Don't promise this without doing that backend work first (new scope, not estimated).
- Gate: another user's data is reachable only through friendship-gated endpoints, with a test for the denied case.

### Phase 7: Profile, first-run, tour, notifications
- [ ] Profile restyle with the Accessibility setting.
- [ ] First-run flow (section 5). Short tour replaces `onboardingTour.js` content, keep `useTourTarget` wiring.
- [ ] Notification explainer after the first floor.
- Gate: a new account reaches its first floor in under 60 seconds on a device.

### Phase 8: cleanup and release candidate
- [ ] Delete old screens and components in one cleanup commit (only items with every parity box ticked).
- [ ] Replace `design/*.png` with the final screens. Update README screenshots.
- [ ] Maestro flows updated, testIDs present.
- [ ] Launch readiness items below.
- [ ] Release candidate build on both platforms.

Launch readiness (real blockers, do in or before Phase 8):
- [ ] Privacy policy URL confirmed live.
- [ ] CI for backend tests and the mobile bundle check.
- [ ] Flyway or equivalent migrations in place of `ddl-auto=update`. Ask first.
- [ ] Secrets only in env vars. Nothing committed.
- [ ] Rate limiting on public and expensive endpoints, especially the coach.
- [ ] Crash reporting on mobile and backend.
- [ ] Database indexes for check-in queries by habit, user and date.
- [ ] Store listing assets from the new UI.

## 12. Parity checklist task

Before deleting any old screen, write a checklist here for each of: `TodayScreen`, `HabitsScreen`, `InsightsScreen`, `CommunityScreen`, `ProfileScreen`, `CreateGroupModal`, `CreateChallengeModal`, `TreeRingChart` and every other component that Phase 8 will delete. Build it from the code and the Maestro flows, one line per user action (for example "edit a habit's reminder time", "undo a check-in", "mark a Shield Day"). Tick each line against the new screen and name the file. Anything the new design does not cover goes to section 14 as a decision, not into the trash.

Checklist: (written Phase 0, from grepping each file's interactive elements — `onPress`/`onValueChange`/navigation calls — not yet ticked against any new screen)

`TodayScreen.js`:
- [ ] Check in / log a check-in
- [ ] Undo a check-in
- [ ] Toggle a Shield Day, open Shield info
- [ ] Repair a broken streak
- [ ] Log progress on a quantitative habit
- [ ] Expand/collapse a habit row
- [ ] Quick-add a habit
- [ ] Navigate to Profile
- [ ] Navigate to Habits (scroll to goals / open create habit)

`HabitsScreen.js`:
- [ ] Open Shield info, open the calendar
- [ ] Open/close the create-habit form
- [ ] Choose tracking mode (Check-off / Quantitative)
- [ ] Toggle "featured goal", toggle reminder enabled
- [ ] Submit create/edit habit
- [ ] Archive a habit, delete a habit
- [ ] Open/close the goal form, choose goal period (Weekly / Monthly), submit a goal
- [ ] Toggle "show archived"
- [ ] Restore an archived habit, delete an archived habit

`InsightsScreen.js`:
- [ ] Select a period tab, step to previous/next period, jump to "now"
- [ ] Navigate to Habits (open create habit)
- [ ] Toggle a habit filter, select a single habit
- [ ] Tap a day cell to open it in the calendar

`CommunityScreen.js`:
- [ ] Open friends list, open notifications
- [ ] Expand/collapse the activity feed
- [ ] Open freeze/shield info
- [ ] Open create-group modal, open "my groups" modal, select a group
- [ ] Open create-challenge modal, open challenges modal, select a challenge
- [ ] Navigate to Insights with a period anchor
- [ ] Empty-state CTA

`ProfileScreen.js`:
- [ ] Edit profile, view my stats
- [ ] Navigate to Habits / Insights(habit) / Community(challenge) from empty states and lists
- [ ] Navigate to AccountSettings, sign out

`CreateGroupModal.js`:
- [ ] Close, select habit to share, name input
- [ ] Select goal alignment, tracking mode, streak rule
- [ ] Toggle nudges enabled, toggle advanced options, select visibility level
- [ ] Create group, delete group

`CreateChallengeModal.js`:
- [ ] Close, name/description input
- [ ] Select icon, color, tracking mode, target count
- [ ] Select cadence type, toggle custom days, select duration preset, toggle open-ended
- [ ] Select visibility
- [ ] Create challenge, delete challenge

`TreeRingChart.js`:
- [ ] No interactive elements — display-only per-day consistency ring. Replaced by the CrossSection (inside-a-tower) view, mockup 07.

## 13. Acceptance, accessibility and copy

- Hold works one-handed with a thumb. Hit area is at least 44dp. Tower tops are not tiny: if a tower is narrower than 44dp on screen, the hit area extends to 44dp.
- Every state has a non-color signal (shape, hatch, label). Check with a grayscale screenshot.
- Reduce Motion removes the cloud drift, rain and landing animation. Floors still appear.
- Screen reader: each tower reads name, floors set in the last 14 days, and current run. An action builds the floor. The sheet list is a full alternative.
- Dynamic type up to 200% does not break the sheet or the forms.
- Copy: no "missed", "failed", "broke", "lost" or "behind". Use "open" for an unbuilt day. Run text is "9 day run". When a run ends, say "New run starts today", not "streak lost".
- Insight and coach copy stays non-causal and tied to counts.
- Light and dark both pass contrast checks.
- Cold start and Skyline load must not be slower than the Phase 0 baseline by more than about 15 percent.

Added 2026-11-10 (`SKYLINE-ADDENDUM.md` section 9), for Phase 2b:
- A user with 2 of 3 gym days this week sees 2 houses, dark windows, "2/3" caption, no warning text.
- A user can log a run they forgot on Sunday from Monday morning without leaving the Skyline tab.
- A user can remove a wrong check-in from a lot's sheet.
- Hold works one-handed on the current lot and on the row's hold-pill. Tap to build works on both.
- Grayscale screenshot of the lots view still shows which rings are dark and which weeks are open.
- Switching between the Daily and Weekly/monthly views keeps scroll position and does not reload data.

## 14. Open decisions

Ask the owner before the phase that depends on each. Proposed defaults are shown but are not decisions.

1. ~~Shield Day storage~~ RESOLVED 2026-11-10 (`SKYLINE-ADDENDUM.md` decision 5): store the shielded date (daily) or period (weekly/monthly) directly in a new table/column; keep `shield_awards` as award-history only. Not yet built.
2. ~~Weather provider~~ RESOLVED 2026-11-09: Option B — a keyless public API (Open-Meteo), coarse coordinates only, called from the device behind a thin `utils/weather.js` wrapper so moving to Option A (backend proxy) later is a one-file change. Open-Meteo also returns sunrise/sunset, used to give `skyKind` real dawn/day/night boundaries instead of just a weather code.
3. Goals feature (before Phase 5). The new design has no home for it. Proposal: a Goals list at the bottom of Insights, using the space left by the removed coach card.
4. Notification center entry (before Phase 6). Proposal: a bell in the Community header.
5. Contextual Ask Habituate (before Phase 3). The Insights entry is removed and the Skyline chat icon stays. Proposal: also keep "Ask about this tower" buttons on the tower sheet and inside view, opening the same `AskHabituateModal`.
6. Habituate Wrapped (before Phase 5). Keep, restyle or drop.
7. Light mode palette (Phase 1). Needs owner review of the first render.
8. ~~Top-out data model~~ RESOLVED 2026-11-10 (`SKYLINE-ADDENDUM.md` decision 6). `habit_towers` segment table confirmed as specified in section 6; top-out threshold is now a per-habit field (default 30 days), not a fixed global rule.
9. Monument restore (Phase 3). Check whether the current app allows unarchive. If it does, keep it.
10. ~~Skia and `expo-location` approvals~~ RESOLVED: Skia not needed (Phase 0 spike — react-native-svg hit the target under the merged-path budget). `expo-location` approved 2026-11-09 for Phase 2's weather pass — requires one EAS dev-client rebuild before it can be used on-device.
11. Mockups not yet drawn: friend skyline, first-run lots, notification explainer, light mode. ~~Weekly/monthly lots view, the lot sheet, "Add for another day," and the faded-top-out result~~ — drawn 2026-11-11 (`concept_screens/1-skyline-daily.png` through `6-top-out-result.png`). The Daily-view screen (1) was compared against the already-built Phase 2 code and matched (header, tower labels, empty-lot marker, bottom sheet) — one minor gap, not yet fixed: long habit names truncate aggressively in tower labels (e.g. "Job appli…"), cosmetic only. Screens 2-6 (weekly/monthly lots, both lot sheets, backdating sheet, top-out result) are reference for Phase 2b/3, not built yet.
12. ~~Month-ring split~~ RESOLVED 2026-11-10 (`SKYLINE-ADDENDUM.md` decision 1): day blocks 1-7/8-14/15-21/22-28/29-end, not calendar weeks.
13. ~~One check-in/day for weekly/monthly habits~~ RESOLVED 2026-11-10 (decision 3): already correct as-is — BOOLEAN habits are capped at 1/day server-side regardless of cadence, COUNT habits are uncapped. No change needed.
14. ~~"Add for another day" window~~ RESOLVED 2026-11-10 (decision 4): last 7 days, including across a period boundary.
15. Confirmed gap, not resolved, logged 2026-11-10: `GroupStreakEngine.java` cannot express a weekly/monthly period (see Phase 6 and section 4a). Needs real backend work before shared habits/challenges with non-daily cadence can be promised.

## 15. Progress log

Keep this to one line per finished phase: date, what shipped, what was not verified. Nothing else goes in this section.

- 2026-11-06/07: Phase 0 (spike and lock) — expo-doctor clean, renderer chosen (react-native-svg), 15 mockups in `design/skyline/`, parity checklist, baseline (1695ms JS-to-Today-loaded). Not verified: iPhone frame time (no device available).
- 2026-11-08/09: Phase 1 (engine and palettes) — `buildScene`/`skyKind` with tests, light/dark skyline palettes, per-category tower colors, the three render components, dev screen confirmed in both modes/all sky kinds on Android. Not verified: iPhone, real on-screen frame time with the actual (non-fixture) shape count, light-mode palette not yet owner-signed-off (first draft only). Advisory subagent review failed (API limit) — self-reviewed instead, caught and fixed two gaps (missing run-band visual, monument color-only signal).
- 2026-11-10: `SKYLINE-ADDENDUM.md` landed (weekly/monthly lots view, revised Shield Day/window/top-out visuals, partial-fill COUNT floors) and its 6 open decisions were answered by the owner, then folded into this file (sections 1, 4, 4a (new), 6, 10, 11 (Phase 2b added), 13, 14) and the addendum deleted. Verified before folding: backdating already works end-to-end (`HabitService.java` + `CalendarModal.js`), one-check-in-per-day is already correctly enforced (keyed on tracking mode, not cadence), check-in deletion has a backend endpoint but no "browse and delete one" client UI yet, and `GroupStreakEngine.java` cannot express weekly/monthly cadence (logged as a real gap, not solved). None of the addendum's new UI (view switch, lots, partial-fill floors, faded top-out compositing, top-out-threshold field) is built yet — Phase 2's existing code still renders every habit as a daily tower with no view switch.
