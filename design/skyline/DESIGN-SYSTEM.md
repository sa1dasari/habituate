# Habituate design system (PROPOSAL, 2026-11-21, awaiting owner approval)

Reference board: `79-design-system.png`. Font is Nunito only (weights 400, 600, 700, 800). Never set fontWeight with a Nunito family; use `fonts.*`.

## Type scale (390 wide, sizes in dp)
| Role | Size / weight | Use |
|---|---|---|
| Hero number | 30 / 800 | big run or count figures |
| Page title | 28 / 800 | tab and screen titles (app token screenTitle moves 26 to 28) |
| Sheet title | 22 / 800 | modal and bottom sheet titles |
| Section title | 18 / 700 | section headers inside a screen |
| Card title | 16 / 700 | card, list row and habit names |
| Message | 15 / 400 | notification text, explainers, prompts |
| Body | 14 / 400 | descriptions, secondary lines |
| Label | 13 / 600 | field labels, chip text, small buttons |
| Meta | 12 / 400 | timestamps, counts, hints |
| Eyebrow | 11 / 800, +0.8 tracking, caps | small overlines |

No half sizes (12.5, 13.5, 14.5, 15.5, 16.5 are retired).

## Buttons
- Primary 54 high, pill, 16 / 800. One per screen or sheet.
- Secondary 48 high, pill, outlined, 15 / 700.
- Compact 44 high, pill, 14 / 700. Icon button 44 round.
- Inline (notification rows) 32 high visual, 13 / 700, with a 44 tap area.
- Chip 36 high, pill, 14 / 700.

## Surfaces
- Page side padding 20. Spacing steps 4, 8, 12, 16, 20, 28.
- Card radius 20, padding 16, gap 12. Tile radius 14, padding 12.
- Input 52 high, radius 16. List row min 56 (64 with a second line).
- Sheet top radius 24, side padding 20, handle 4 by 40.

## Changes against today's code (theme.js)
screenTitle 26 to 28; add heroNumber 30, sheetTitle 22, message 15, eyebrow 11; sectionTitle 16 to 18; cardTitle stays 16; radii add 14, 20, 24; add button heights 54/48/44/32.
