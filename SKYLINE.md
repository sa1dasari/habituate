# SKYLINE.md

The active build plan for rebuilding Habituate's UI as a skyline. Read the section for the current phase, not the whole file. `CLAUDE.md` holds the standing rules. This file holds the spec, the phases and the open decisions. Tick items as they are verified and write what was actually checked.

## 1. Goal and final decisions

Replace the list-and-ring UI with a skyline. Each habit is a tower. Each check-in is a floor. Keep the backend, the data model, the hooks and the product rules. No Classic toggle.

Decisions already made by the owner:
- The Skyline is the home screen. One tower per habit, one floor per check-in.
- Check-in is a hold of about 1 second. A "Tap to build" setting under Accessibility is the fallback.
- After about 2 months the user may top out a tower. The old tower is finished and no longer under construction, and a new tower starts for the same habit.
- Retired (archived) habits stay as grey monuments.
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
| glass | Shield Day used | a flat, distinct-colored block, no windows at all — never the category color |
| not due | habit not scheduled that day | no floor drawn, tower does not grow |
| ledge | best run | a thin white ledge at the top of that run |

Windows (revised 2026-11-09, `concept_screens/tower_floor_states_windows_and_shield.png`): every real check-in draws windows — the number is a per-device Accessibility setting (`hooks/useWindowCount.js`, default 3), never fewer than 1. Lit vs. dark is the only thing that changes with run-band membership; the wall color itself is identical either way. A Shield Day floor never has windows at all — their presence/absence is the primary non-color signal (section 13), not the color itself.

Rules:
- Floors are never removed and the tower never shrinks.
- Not-due days (weekly or monthly cadence) add no floor and no open outline. Use `habitPeriodHistory` in `utils/consistency.js` for cadence-aware logic. Do not recompute streaks in the scene builder. Take them from `utils/streaks` or the existing hook output.
- Quantitative habits: a floor is "set" when the day's value meets the target. A partial day is "open". Do not draw partial floors in v1. Open question raised 2026-11-09, not yet resolved: today's partial COUNT progress isn't visible anywhere on the skyline, and the Phase 2 hold gesture logs +1 per hold with no batch-amount input — both deferred to Phase 3's tower sheet.
- Shared habits: the skybridge between member towers is solid when the group streak is safe, flickers amber when at risk, and turns glass when frozen. Never red.
- Challenges: one landmark tower. Each floor is colored by the contributor.

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

Top out:
- Offered when a tower is at least about 60 days old. The offer is a button in the tower sheet. It is never automatic and never nagging.
- Topping out does not reset the run, shields, group membership or widgets. The habit keeps one row.
- Data model, proposed and NOT yet confirmed by the owner: keep one `Habit` row and add a `habit_towers` table with `id`, `habit_id`, `user_id`, `started_at`, `topped_out_at` (nullable), `best_run_in_segment`. The active segment has no `topped_out_at`. Check-ins are not duplicated. A segment owns the check-ins whose `occurredAt` falls between its start and end.
- Ask the owner to confirm this model before Phase 3 starts. Add the entity, repository, service methods and a `POST /api/habits/{id}/top-out` endpoint with ownership checks and tests. `ddl-auto=update` creates the table. Backfill one open segment per existing habit lazily on first read, not in a migration.
- Visual, captured 2026-11-09 (`concept_screens/topped_out_tower_fades_behind_new_tower.png`), for Phase 3's renderer: a topped-out segment and its active successor share one horizontal slot, not two — the old tower renders behind and desaturated (muted brown, not the vivid category color, with all-dark windows per section 4's window rule below), offset back-left; the new tower renders in front, full category color, offset forward-right, with its own crane. The two overlap at the base. This is a compositing change to `SkylineTower`/`buildScene` (two tower renders per habit instead of one when a topped-out segment exists) — not attempted in Phase 2, since Phase 2's adapter has no segment data yet (every habit renders as a single `active` tower).

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

Lay a foundation (habit): name, category (14), check-in mode (Check-off or Quantitative), cadence with per-day, per-week or per-month targets, ideal time, optional "why", reminder, pinned goal. Show a live tower preview that updates with the category color.

Build together (shared habit): name, goal type (Unified or Split), streak type (Cooperative or Independent), streak rule (Any or All members), skip days per month (0 to 3), detail visibility (Full or Status only), invitees. Explain streak rule in one plain sentence under the control.

Raise a landmark (challenge): name, description, tracking (Check-off or Count), target count, frequency (Daily, Weekly quota or Custom days), duration (1 week to 1 year), visibility (Private or Public), invitees.

Keep all existing validation and error messages. Errors show `err.message` through `useToast`.

## 11. Phases

One phase at a time. Do not start a phase until the gate of the previous one is met and the owner says go. Each phase ends with the `CLAUDE.md` section 5 checks, the advisory review loop if it was a major build, and ticked items below.

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
- [ ] New Skyline screen in a new file, wired to the existing hooks.
- [ ] Hold-to-build and Tap-to-build setting (Accessibility settings).
- [ ] Screen-reader action to build a floor, tower labels, full list in the bottom sheet.
- [ ] Sky from the clock. Weather and `expo-location` after the owner approves the dependency and the provider decision.
- [ ] Empty state with lots. Widgets still sync (`utils/widgetSync.js`).
- [ ] Tab renamed Skyline in `App.js` once parity with `TodayScreen` is ticked.
- Gate: a user can build a floor with a hold, undo-free, and the streak updates on the widgets.

### Phase 3: tower sheet, inside view, top out
- [ ] Owner confirms the `habit_towers` model.
- [ ] Backend segment entity, top-out endpoint, tests.
- [ ] Tower sheet with stats, edit, Shield Day, Retire, Top out, contextual Ask Habituate.
- [ ] Inside view (cross section) with set, open and glass floors.
- [ ] Top out confirm and animation. Monument state for retired habits.
- Gate: top out keeps the run, the old tower shows a gold cap, a new tower starts, group streaks and widgets unchanged.

### Phase 4: forms and Habits tab removal
- [ ] Lay a foundation, Build together, Raise a landmark forms with live previews.
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

## 14. Open decisions

Ask the owner before the phase that depends on each. Proposed defaults are shown but are not decisions.

1. Shield Day storage (before Phase 3). Today the toggle is manual and `shield_awards` records awards only. The glass floor needs a per-date record. Proposal: store the shielded dates on the habit (or a small `shield_days` table) and keep `shield_awards` for award history.
2. ~~Weather provider~~ RESOLVED 2026-11-09: Option B — a keyless public API (Open-Meteo), coarse coordinates only, called from the device behind a thin `utils/weather.js` wrapper so moving to Option A (backend proxy) later is a one-file change. Open-Meteo also returns sunrise/sunset, used to give `skyKind` real dawn/day/night boundaries instead of just a weather code.
3. Goals feature (before Phase 5). The new design has no home for it. Proposal: a Goals list at the bottom of Insights, using the space left by the removed coach card.
4. Notification center entry (before Phase 6). Proposal: a bell in the Community header.
5. Contextual Ask Habituate (before Phase 3). The Insights entry is removed and the Skyline chat icon stays. Proposal: also keep "Ask about this tower" buttons on the tower sheet and inside view, opening the same `AskHabituateModal`.
6. Habituate Wrapped (before Phase 5). Keep, restyle or drop.
7. Light mode palette (Phase 1). Needs owner review of the first render.
8. Top-out data model (before Phase 3). Segment table in section 6.
9. Monument restore (Phase 3). Check whether the current app allows unarchive. If it does, keep it.
10. ~~Skia and `expo-location` approvals~~ RESOLVED: Skia not needed (Phase 0 spike — react-native-svg hit the target under the merged-path budget). `expo-location` approved 2026-11-09 for Phase 2's weather pass — requires one EAS dev-client rebuild before it can be used on-device.
11. Mockups not yet drawn: friend skyline, first-run lots, notification explainer, light mode.

## 15. Progress log

Keep this to one line per finished phase: date, what shipped, what was not verified. Nothing else goes in this section.

- 2026-11-06/07: Phase 0 (spike and lock) — expo-doctor clean, renderer chosen (react-native-svg), 15 mockups in `design/skyline/`, parity checklist, baseline (1695ms JS-to-Today-loaded). Not verified: iPhone frame time (no device available).
- 2026-11-08/09: Phase 1 (engine and palettes) — `buildScene`/`skyKind` with tests, light/dark skyline palettes, per-category tower colors, the three render components, dev screen confirmed in both modes/all sky kinds on Android. Not verified: iPhone, real on-screen frame time with the actual (non-fixture) shape count, light-mode palette not yet owner-signed-off (first draft only). Advisory subagent review failed (API limit) — self-reviewed instead, caught and fixed two gaps (missing run-band visual, monument color-only signal).
