# Habituate design system (PROPOSAL v2, 2026-11-21, awaiting owner approval)

Reference board: `79-design-system.png`. Nunito only (400, 600, 700, 800). Never set fontWeight with a Nunito family; use `fonts.*`. Line height about 1.35 x size. Checked against Apple HIG and Android accessibility docs; Material 3 values are from memory and unverified.

## Type scale (dp, size/line height, weight)
| Role | Spec | Use |
|---|---|---|
| Hero number | 36/40, 800 | big run or count figures |
| Page title | 28/34, 800 | tab and screen titles (theme screenTitle 26 to 28) |
| Sheet title | 22/28, 800 | sheet and modal titles |
| Section title | 18/24, 700 | section headers (theme sectionTitle 16 to 18) |
| Card title | 16/22, 700 | card, row and habit names |
| Message | 16/24, 400 | notification text, coach replies, explainers |
| Body | 14/20, 400 | short descriptions, secondary lines |
| Label | 13/18, 600 | field labels, chip text, inline buttons |
| Meta | 12/16, 400 | timestamps, counts; never for actions or status |
| Eyebrow | 12/16, 800, caps, +0.5 tracking | overlines |

No half sizes. Never disable font scaling; cap with maxFontSizeMultiplier 1.3 only on hero, eyebrow and tab labels. Test Android 200% font scale at 360dp.

## Buttons and controls
- Primary 54, pill, 16/800, one per screen. Secondary 48, outlined, 16/700. Compact 44, 14/700. Icon 44 round.
- Inline 32 visual, 13/700. Chip 36 visual, 14/700.
- Every control has a 48dp tap area (hitSlop). This raises the project's 44dp rule to 48 for Android.
- Input 56, radius 16. List row min 56 (72 with a second line).

## Surfaces and spacing
- Spacing 4, 8, 12, 16, 24, 32. Page side padding 20 (sheets too).
- Card radius 20, padding 16, gap 12. Tile radius 14, padding 12. Sheet top radius 28, handle 4x40.
- Muted text (meta, eyebrow) must reach 4.5:1 on dark and light surfaces; check before build.

## theme.js changes
screenTitle 28, sectionTitle 18; add heroNumber 36, sheetTitle 22, message 16, eyebrow 12; radii add 14, 20, 28; button heights 54/48/44/32; spacing 24 and 32.
