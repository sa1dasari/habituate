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
| 03 | `03-towersheet.png` | Tower sheet | 3 | current for floor art (redrawn 2026-11-13). The 2x2 button grid and the "Ask about this tower" label are **proposals** waiting on the owner (SKYLINE §14 #5). |
| 04 | `04-topout.png` | Top out confirm | 3 | interaction only (past floors drawn without windows) |
| 05 | `05-skystates.png` | Sky and weather | 2 | interaction only (not re-checked tower by tower; assume old floor art) |
| 06 | `06-insights.png` | Insights | 5 | **replace pending**: the owner's newer mockup (tabs "8 weeks / 6 months / Year", stacked Floors chart per habit, Runs card, Shield use card) supersedes this board's tabs, chart and Compare card. Owner decisions the developer recorded but that aren't in that image: the Daily tab is dropped, and the "Selected habits" breakdown stays alongside the new cards, Compare is out of Phase 5, and freeform Goals was removed (SKYLINE §14 #3, resolved 2026-11-12), so it gets no slot on Insights. |
| 07 | `07-crosssection.png` | Inside view | 3 | current for floor art (redrawn 2026-11-13). The 2x2 button grid and the "Ask about this tower" label are **proposals** waiting on the owner (SKYLINE §14 #5). |
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
| 22 | `22-floor-states-reference.png` | Floor states: lit, solid Shield block, open, dark | all | **reference: the source of truth for floor art** (was `tower_floor_states_windows_and_shield.png`) |

`superseded/` keeps the old versions of 01, 03 and 07 for history. Don't build from them.

## Floor states (from 22, matching `skylineTowerTheme` in `mobile/theme.js`)
| State | Look |
|---|---|
| Built, inside current run | category color, **lit** windows (`windowLit`) |
| Built, past run | category color, **dark** windows (`windowDark`) |
| Shield Day | flat `shieldFill` block, **no windows**. It is never a glass or hatched floor. |
| Open day | dark void block with a thin `openStroke` outline. Never a hole, crack or "missed" label. |
| Today, not yet built | dashed amber outline on top |
| Best run | white ledge |

## Not drawn yet
- Friend skyline (Phase 6)
- First-run empty-lot screens (Phase 7)
- Notification explainer (Phase 7)
- Light mode (Phase 1 open decision)

## Regenerating 03 and 07
`source/screens.html` draws both boards. From `design/skyline/source/`, run `node shot.js`. It uses the Playwright that is preinstalled in the cloud sessions, and writes `towersheet.png` and `crosssection.png` next to the script. Copy those over `03-towersheet.png` and `07-crosssection.png`.
