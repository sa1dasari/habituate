# design/skyline — the UI spec

This is the only folder of Skyline mockups. The old `concept _screens/` folder was merged in here on 2026-11-13. Fifteen of its files were byte-identical copies of the boards below, and the rest were moved and renumbered. Every board is dark mode, 390 × 844 pt, exported at 2x.

**Status key**
- **current**: build to this board.
- **interaction only**: the layout and interaction are right, but the tower art predates the floor-state revision (2026-11-09/10). Draw floors per `22-floor-states-reference.png`, not as this board shows them.
- **replace pending**: the owner has a newer version that isn't in the repo yet.

| # | File | Screen | Phase | Status |
|---|---|---|---|---|
| 01 | `01-skyline.png` | Skyline home, Daily view | 2 | current. Header updated 2026-11-16 with the retired-towers icon (archive) beside chat and profile; the subtitle wraps to two lines. The icon already exists in the build. |
| 02 | `02-hold.png` | Hold to build | 2 | interaction only (glass Shield Day on Run, past floors drawn without windows) |
| 03 | `03-towersheet.png` | Tower details | 3 | **current, approved by the owner 2026-11-13.** See-through open floor, glass + shield Shield Day. The eyebrow "TOWER DETAILS" names the page; the habit name is the title (always present, since a name is required); the optional "Why does this matter?" text shows as a muted italic line only when set. A Top out card appears only when the tower is eligible, then a 2-column grid of 6 buttons (Shield Day · count, Add another day, See inside, Ask about tower, Edit, Retire). | **Build gap (2026-11-14):** the build is a full-screen page with a stats row; it must become a bottom sheet over the live sky with the tower picture, run headline and floor legend, as drawn.
| 04 | `04-topout.png` | Top out confirm | 3 | interaction only (past floors drawn without windows) |
| 05 | `05-skystates.png` | Sky and weather | 2 | interaction only (not re-checked tower by tower; assume old floor art) |
| 06 | `06-insights.png` | Insights | 5 | **current, owner-approved 2026-11-13** (the owner's v2 mockup; the Shield use squares and footnote were redrawn to the glass + shield look). Three cards. **Floors built** (daily towers only): "N so far this week/month" with "Last week/month at this point: N", a stacked bar chart per habit with a legend, and tabs 8 weeks / 6 months / Year (Year = 12 monthly bars). **Runs**: every habit, a "Best" badge on the longest current run, a bar filled to current/best with a white tick at best. **Shield use**: two tiles over 12 weeks, then a dot timeline per habit with a small glass square + shield on each shielded week, and the footnote "A Shield Day is a glass floor with a shield on the tower. It keeps the run going." Owner decisions: no Daily tab, the "Selected habits" breakdown stays, Compare is out of Phase 5, Goals was removed. The developer's branch also has a copy of the older 06; keep this one. |
| 07 | `07-crosssection.png` | Inside view | 3 | **current, approved 2026-11-13** (redrawn 2026-11-13: see-through open floor, glass + shield Shield Day). The title is "Inside view" with the habit name under it; back goes to Tower details. | **Not built yet (2026-11-14):** the build has only the day-by-day list. The visual tower with the drag handle is still to build, and the list stays as the screen-reader version.
| 08 | `08-community.png` | Community, shared habits | 6 | interaction only (not re-checked tower by tower) |
| 09 | `09-challenges.png` | Community, challenges | 6 | interaction only (not re-checked tower by tower) |
| 10 | `10-sharedhabit.png` | Shared habit (skybridge) | 6 | interaction only (past floors drawn without windows) |
| 11 | `11-challenge.png` | Challenge (landmark) | 6 | interaction only (not re-checked tower by tower) |
| 12 | `12-newtower.png` | Lay a foundation form | 4 | interaction only. No top-out threshold field, and that is correct for create: the field ("Top out after (days)", default 30) appears only when editing a tower, because the create API doesn't accept it. An edit-form board isn't drawn yet. Subtitle says "check in" where the copy should say "build a floor". The Lay foundation button overlaps the last field. |
| 13 | `13-newshared.png` | Build together form | 4 | not re-checked |
| 14 | `14-newchallenge.png` | Raise a landmark form | 4 | not re-checked |
| 15 | `15-profile.png` | Profile | 7 | interaction only (the "Your skyline so far" towers use old floor art) |
| 16 | `16-weekly-monthly.png` | Skyline, Weekly and monthly view (per-day heatmap lots) | 2b | current (was `concept _screens/2-weekly-monthly.png`) |
| 17 | `17-lot-sheet-weekly.png` | Lot sheet, weekly | 2b | current (was `3-lot-sheet-weekly.png`) |
| 18 | `18-add-for-another-day.png` | Add for another day | 2b / 3 | current (was `4-add-for-another-day.png`) |
| 19 | `19-lot-sheet-monthly.png` | Lot sheet, monthly | 2b | current (was `5-lot-sheet-monthly.png`) |
| 20 | `20-top-out-result.png` | Top out result | 3 | current (was `6-top-out-result.png`) |
| 21 | `21-topout-fade-reference.png` | Topped-out tower fades behind the new one (~40%) | 3 | reference (was `topped_out_tower_fades_behind_new_tower.png`) |
| 22 | `22-floor-states-reference.png` | Floor states: lit, solid Shield block, open, dark | all | **reference: the source of truth for floor art.** Approved and redrawn 2026-11-13 with a see-through open floor and a glass + shield Shield Day (owner decisions); the old version is in `superseded/`. |
| 23 | `superseded/23-insights-filter-proposal.png` | Insights habit filter (approved, then merged into 28–30) | 5 | superseded: the chips row now lives on boards 28–30. |
| 24 | `24-sheet-tall-tower-A-side.png` | Tower details, tall tower, option A | 3 | **APPROVED by the owner 2026-11-14.** Used when the tower is tall: short towers keep the bottom grid of board 03, tall ones switch to this side layout. Actions sit in a column beside a tall tower; the floor legend collapses behind "What the floors mean". |
| 25 | `superseded/25-sheet-tall-tower-B-pinned.png` | Tower details, tall tower, pinned actions | 3 | **not chosen** by the owner 2026-11-14 (option A, board 24, won). |
| 26 | `26-inside-view-build-open-day.png` | Inside view, build an open day | 3 | **APPROVED by the owner 2026-11-14.** Any past open day since the habit started, but personal habits only; shared habits keep the 7-day limit. The sheet's quick "Add another day" list stays. Selecting an open day shows "Hold to build" in the day tooltip, so any past day can be filled from here. |
| 27 | `27-lot-sheet-day-callout.png` | Lot sheet (monthly), per-day chart callout | 2b | **APPROVED by the owner 2026-11-14.** Tapping a day in the grid or the chart shows the callout; counts also stay inside the grid squares. One callout above the selected day instead of a label on every bar. |
| 28–30 | `28-insights-weeks.png`, `29-insights-months.png`, `30-insights-years.png` | Insights main page, Weeks / Months / Years tabs | 5 | **APPROVED by the owner 2026-11-14.** Replaces the Floors built card of board 06. Tabs read Weeks / Months / Years. There is no subtitle under the title (the owner found it misleading). The "This week / This month / This year" arrows page back through earlier windows, so all history is reachable. Runs is all-time and Shield use covers the last 12 weeks; neither is limited by the chart window. Floors built counts weekly and monthly habits too (their check-ins), tagged "Towers and lots", and the line under the headline splits floors and lot check-ins. Tapping a bar opens the details page. Runs and Shield use are unchanged. |
| 31–33 | `31-insights-week-details.png`, `32-insights-month-details.png`, `33-insights-year-details.png` | Period details (week, month, year) | 5 | **APPROVED by the owner 2026-11-14.** One page for everything about a period: two summary tiles, a day-by-day (month-by-month for years) chart, then a card per habit with its own strip (7 days, a 7-column month grid, or 12 months), floors against the same point last period, current and best run, and Shield Days used. Weekly/monthly habits show a target bar. Previous/next arrows step between periods. Uses the glass Shield Day and see-through open floor. |
| 34 | `34-firstrun-empty-skyline.png` | First run: empty skyline | 7 | **PROPOSAL, awaiting owner approval (2026-11-16).** SKYLINE §5 step 3. Three empty lots with plus signs, "Lay a foundation" button. The retired-towers icon is not shown here because there is nothing retired yet (to be confirmed). The wording "Your skyline starts here" and "Lay your first foundation" is mine. |
| 35 | `35-firstrun-templates.png` | First run: Lay a foundation, templates | 7 | **PROPOSAL.** The 6 templates from TemplateHabitsPicker (Drink water, Read 10 minutes, Meditate, Go for a walk, Sleep by 11pm, Tidy up) with their category icon colours, then Custom last (SKYLINE §5 step 3). Subtitle wording is mine. |
| 36 | `36-firstrun-first-hold.png` | First run: first hold | 7 | **PROPOSAL.** SKYLINE §5 step 4: a one-line hint and the ring filling. Mentions Tap to build in Profile, Accessibility. Wording is mine. |
| 37 | `37-firstrun-notification-explainer.png` | First run: notification explainer | 7 | **PROPOSAL.** SKYLINE §5 step 5, shown after the first floor, before the system prompt. All copy is mine; no existing explainer text was found. |
| 38 | `38-firstrun-location-explainer.png` | First run: location explainer | 7 | **PROPOSAL.** SKYLINE §5 step 6. Uses the existing LocationPermissionModal copy word for word, restyled. |
| 39 | `39-retired-towers-list.png` | Retired towers list | 3 | **PROPOSAL, awaiting owner approval (2026-11-16).** Restyle of the existing screen: icon tile, name, Restore, delete. The explanatory line under the list is mine. The developer confirms the list already opens from a header icon. |
| 40 | `40-notification-center.png` | Notification center | 7 | **PROPOSAL.** Restyle of the existing center: close, "Notifications", mark-all-read, rows with a type icon, title, body, time and an unread dot. All sample titles and bodies are mine; the real ones come from the server. It already opens from a bell in the Community header (confirmed by the developer). |
| 41 | `41-ask-habituate-chat.png` | Ask Habituate, conversation | 7 | **PROPOSAL.** Uses the existing strings: "Ask Habituate", "Ask about your routine...", "AI suggestions can be imperfect. You're in control.", "Nothing changes until you confirm.", "Confirm adjustment" / "Keep my goal". The question and answer text are sample copy, written non-causally. |
| 42 | `42-ask-habituate-empty.png` | Ask Habituate, empty state with starter questions | 7 | **PROPOSAL.** Starter questions are generated from the user's habits in the app; the three shown and the heading text are my sample copy. |
| 43 | `43-friend-skyline-public.png` | Friend skyline, public profile | 6 | **PROPOSAL, blocked on an owner decision.** Shows a public friend's towers with habit names. The developer found that the server deliberately does NOT expose per-habit data for public profiles, so this needs a rule change and a new endpoint. |
| 44 | `44-friend-skyline-private.png` | Friend skyline, private profile | 6 | **PROPOSAL, blocked on the same decision.** Only the shared-habit towers you both belong to, joined by a skybridge, plus the existing "keeps their stats private" note. Needs floor and run data for shared towers, which the server does not return today. |

`superseded/` keeps old versions and boards that were not chosen (01, 03, 06, 07, 22, 23, 25). Don't build from them.

## Floor states (from 22, matching `skylineTowerTheme` in `mobile/theme.js`)
| State | Look |
|---|---|
| Built, inside current run | category color, **lit** windows (`windowLit`) |
| Built, past run | category color, **dark** windows (`windowDark`) |
| Shield Day | **glass floor with a small shield icon** (owner decision 2026-11-13, replacing the solid block): tinted fill `#8FB8D8` at 45% (side `#6F98B8`), bright `#DDF2FF` edge, white shield icon centered on the front face when the floor is ≥ 8 pt tall. No windows and **no hatch or diagonal line**. The tint and bright edge are what tell it apart from a see-through open floor at small sizes. |
| Open day | see-through: an `openStroke` outline only, so the sky shows through (owner decision 2026-11-13, matching the build). Never filled dark, never a crack or "missed" label. |
| Today, not yet built | dashed amber outline on top |
| Best run | white ledge |

## Text rules (owner, 2026-11-13)
- Tower names (up to 200 characters) wrap to 2 lines, then end in …; the screen-reader label reads the full name. This applies to the Tower details and Inside view titles.
- "Why does this matter?" (`motivation`) shows on Tower details only when set. Nothing is shown when it's empty.

## Not drawn yet
- Friend skyline (Phase 6)
- First-run empty-lot screens (Phase 7)
- Notification explainer (Phase 7)
- Light mode (Phase 1 open decision)

## Regenerating 03 and 07
`source/screens.html` draws 03, 07, 22 and two comparison views. From `design/skyline/source/`, run `node shot.js towersheet crosssection floorstates`. It uses the Playwright that is preinstalled in the cloud sessions, and writes `<screen>.png` next to the script. Copy each over its board.
