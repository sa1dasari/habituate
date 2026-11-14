# design/skyline — the UI spec

This is the only folder of Skyline mockups. The old `concept _screens/` folder was merged in here on 2026-11-13. Fifteen of its files were byte-identical copies of the boards below, and the rest were moved and renumbered. Every board is dark mode, 390 × 844 pt, exported at 2x.

**Status key**
- **current**: build to this board.
- **interaction only**: the layout and interaction are right, but the tower art predates the floor-state revision (2026-11-09/10). Draw floors per `22-floor-states-reference.png`, not as this board shows them.
- **replace pending**: the owner has a newer version that isn't in the repo yet.

| # | File | Screen | Phase | Status |
|---|---|---|---|---|
| 01 | `01-skyline.png` | Skyline home, Daily view | 2 | current (was `concept _screens/1-skyline-daily.png`) |
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
| 23 | `23-insights-filter-proposal.png` | Insights with a habit filter row | 5 | **APPROVED by the owner 2026-11-14.** Board 06 plus one row of habit chips under the tabs: "All" (default) and one chip per habit, multi-select, the row scrolls sideways when there are many habits. Selected habits filter all three cards (Floors built, Runs, Shield use). Replaces the old "Selected habits" card, the "This week, day by day" chart and the "Selected-period details" block, which are removed. Weekly/monthly habits only affect Runs, since Floors built is daily towers only. Not drawn: the selected state with 1–3 chips on. |
| 24 | `24-sheet-tall-tower-A-side.png` | Tower details, tall tower, option A | 3 | **APPROVED by the owner 2026-11-14.** Used when the tower is tall: short towers keep the bottom grid of board 03, tall ones switch to this side layout. Actions sit in a column beside a tall tower; the floor legend collapses behind "What the floors mean". |
| 25 | `25-sheet-tall-tower-B-pinned.png` | Tower details, tall tower, option B | 3 | **NOT CHOSEN (2026-11-14):** the owner picked option A (board 24). Kept for reference only. One layout for every tower: content scrolls, the Top out card and 6 buttons are pinned at the bottom. |
| 26 | `26-inside-view-build-open-day.png` | Inside view, build an open day | 3 | **APPROVED by the owner 2026-11-14.** Any past open day since the habit started, but personal habits only; shared habits keep the 7-day limit. The sheet's quick "Add another day" list stays. Selecting an open day shows "Hold to build" in the day tooltip, so any past day can be filled from here. |
| 27 | `27-lot-sheet-day-callout.png` | Lot sheet (monthly), per-day chart callout | 2b | **APPROVED by the owner 2026-11-14.** Tapping a day in the grid or the chart shows the callout; counts also stay inside the grid squares. One callout above the selected day instead of a label on every bar. |

`superseded/` keeps the old versions of 01, 03, 07 and 22 for history. Don't build from them.

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
