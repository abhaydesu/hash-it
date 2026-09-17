# Hash-It Design System

## Identity

A technical drafting sheet / lab notebook for measuring recall. Reference structure: [chanhdai.com](https://chanhdai.com) — one fixed centre column, full-bleed hairline rules that cross the column edges, spec-sheet metadata cells. Not a SaaS dashboard.

Do not lift the reference's handwritten script annotations.

## Three-layer colour

Layers never overlap roles.

1. **Neutral** — paper, rules, type, dither. Majority of every screen.
2. **Orange — interaction / decision only.** Primary buttons, active nav, selected filters/tabs, focus rings, checked states, body links, figure fig-marks, colophon links. Never encodes data.
3. **Semantic data** — difficulty, solve outcome, overdue, recall. Never on chrome.

### Neutral ramp

| Token | Light | Dark | Use |
|-------|-------|------|-----|
| `--background` | `50 8% 97%` | `30 6% 8%` | Paper |
| `--foreground` | `30 8% 12%` | `40 8% 92%` | Ink |
| `--muted` | `40 6% 92%` | `30 5% 15%` | Quiet fills |
| `--muted-foreground` | `30 6% 40%` | `35 6% 62%` | Labels |
| `--border` | `35 8% 82%` | `30 5% 22%` | Hairlines |

Paper is cooled a half-step off cream so saturated orange reads as signal, not clay-on-cream.

### Orange scale (signal, not wash)

| Step | Light HSL | Dark HSL |
|------|-----------|----------|
| 50–200 | pale tints for rare washes | deep muted bases |
| 400 | `24 95% 58%` | `24 78% 44%` |
| **500** | **`24 95% 48%`** | **`24 95% 58%`** |
| 600–700 | pressed / hover | lighter hover |

Use on small decisive elements. Separate light/dark values — opacity alone will not hold contrast.

### Semantic data

| Meaning | Token | Treatment |
|---------|-------|-----------|
| Easy | `--easy` green | Quiet border + text, no fill |
| Medium | `--medium` amber | Quiet border + text (LeetCode-familiar; desaturated vs orange controls) |
| Hard | `--hard` red | Quiet border + text |
| Failure / overdue | `--warning` / destructive | Quiet border + text |
| Recall estimate | `--recall` teal | Quiet; mastery grid uses **dither density**, not a colour ramp |

## Typography

- **Family:** Manrope (sans) for UI and body. IBM Plex Mono only for code and user-written invariants (idea/mistake text when presented as notes).
- **Not** Geist or Inter.
- **Tabular figures** (`tabular-nums`) for every aligning number.
- **Sentence case** everywhere. No presentational `uppercase`. No arrows on button labels. No middle-dot meta strings.
- **Scale**
  - Display: 36–48px, weight 600, tracking −0.04em
  - Title: 24–30px, weight 600, tracking −0.035em
  - Heading: 16px, weight 600, tracking −0.02em
  - Body: 14px, relaxed, max ~80ch / `max-w-[40rem]`
  - Label: 11px, medium, slight positive tracking
  - Caption: 12px, muted

## Structure

### Sheet grid

Fixed centre column (`max-w-[1040px]`) with vertical hairlines on both sides, unbroken header → footer. Header, nav, and content share those edges.

### `<SheetSection>`

Full-width wrapper owns the full-bleed bottom hairline (`100vw`, centred). Optional dither band. Inner element applies horizontal padding. Use on every section — never hand-draw page rules.

### Borders

A container and its children never both have borders. Bordered parent → children separated by `divide-y` / `gap-px` hairlines only.

### Spec-sheet cells

`SpecGrid` + `SpecCell`: label above, value below, one fact per cell.

### Figure captions

`Fig. N. Title.` — orange on the fig mark. Sparingly.

## Dither

1-bit ordered (Bayer-like) field via CSS radial dots. Never animated. Never a raster. Not full-height page margins.

| Class | Density | Where |
|-------|---------|-------|
| `bg-dither-25` | ~25% | Section separator bands, skeletons, empty panels, figure grounds |
| `bg-dither-50` | ~50% | Stronger separator / colophon ground |
| `bg-dither-orange` | accent | Landing hero band only (fades under headline) |
| `dither-mastery-0…4` | recall levels | `/patterns` mastery grid only |

## Components

- **Button:** `primary` (orange), `secondary`, `ghost`, plus outcome set (`outcome-good|hard|again|failed`) — semantic, outlined, not chrome orange.
- **Input / Select:** one border, orange focus ring.
- **Badge:** quiet variants by meaning (difficulty, status, pattern, flag).
- **Loader:** dither skeletons shaped like content. No spinner+caption.
- **Surfaces:** `surface-panel` = single border, paper fill.

## Anti-defaults (step 3 check)

A generic “clean developer dashboard” brief would produce: Inter/Geist, purple or soft indigo accent, rounded cards with soft shadows, icon+stat card grids, pill filters, dashboard chrome. Rejected here in favour of: Manrope, saturated orange as decision signal only, hairline sheet geometry, dither bands instead of cards, spreadsheet density on `/problems`, mastery as pixel field.

## Wireframes

### `/` (landing)

```text
|======== 100vw hairline ==============================================|
|          |  [dither-orange hero band, fades]               |          |
|  margin  |  Hash-It (implied by product line)              |  margin  |
|          |  Headline                                       |          |
|          |  [Get started] [Explore catalog]                |          |
|          |  ──────── figure on dither-25 ────────          |          |
|          |  [queue render]                                 |          |
|          |  Fig. 1. The daily review queue.                |          |
|----------|=================================================|----------|
|          |  The problem … | What changes …                 |          |
|----------|=================================================|----------|
|          |  How it works (figure)                          |          |
|----------|=================================================|----------|
|          |  Colophon SpecGrid                              |          |
|==========|=================================================|==========|
```

### `/today`

```text
|----------| Today · sentence meta                           |----------|
|----------| SpecGrid: logged | cold% | due | stuck          |----------|
|----------| Today's review                                  |----------|
|          | queue rows (hairline dividers, shared surface)   |          |
|----------| Pattern drill | Blind mock                      |----------|
```

### `/patterns`

```text
|----------| Patterns                                        |----------|
|----------| Mastery grid — dither density = recall          |----------|
|          | Fig. N. Pattern mastery.                        |          |
|----------| Selected pattern detail table                   |----------|
```
