# Hash-It design system

## 1) Palette

Chrome is a neutral warm-paper system, with colour reserved for data meaning instead of decoration.

Neutral ramp:
- Paper: #F8F5F1
- Panel: #F3EEE7
- Line: #D7CEC0
- Muted: #9E9488
- Ink: #1D1A17
- Black: #0E0D0B

Data colours:
- Easy: #7C9E74
- Medium: #C38B4C
- Hard: #B85C4A
- Cold / failed: #B85C4A
- Hint / review: #8E7A63
- Overdue: #C07F3C
- Retrieval ramp: #E3D8C7 → #CBB69B → #A77B57 → #6F4A35

These values are intentionally warm and low-contrast for the chrome layer so the graph, difficulty, and failure states read as the real signal.

## 2) Type

Typeface choice:
- Sans: Manrope
- Mono: IBM Plex Mono

Reason: Manrope gives the product a more deliberate editorial feel than generic UI sans while staying readable in a dense tool. The mono face is reserved for data-like, code-like invariants rather than labels.

Type scale:
- Display: 48 / 52 / 700 / -0.06em
- H1: 36 / 40 / 700 / -0.05em
- H2: 28 / 32 / 600 / -0.04em
- H3: 20 / 28 / 600 / -0.02em
- Body: 16 / 28 / 400 / 0
- Small body: 14 / 22 / 400 / 0
- Meta: 11 / 16 / 500 / 0.08em

Numbers and aligned columns use tabular figures via font-variant-numeric: tabular-nums.

## 3) Layout concept

Concept: a quiet lab notebook on a dark desk; the tool reads like a daily memory instrument, not a SaaS shell.

ASCII wireframes:

/ (landing)
```
┌────────────────────────────────────────────────────────────────────────────┐
│ HASH_IT                                                   [roadmap] │
├────────────────────────────────────────────────────────────────────────────┤
│ hero: single product mockup + headline + subhead + CTA                     │
│                                                                            │
│ how it works (4 short typographic steps)                                   │
│                                                                            │
│ proof / real counts / single feature statement                             │
└────────────────────────────────────────────────────────────────────────────┘
```

/today
```
┌────────────────────────────────────────────────────────────────────────────┐
│ Today                                                                │
├────────────────────────────────────────────────────────────────────────────┤
│ quiet stats row                                                            │
│                                                                            │
│ review queue: full width cards, no dead left gutter                         │
│                                                                            │
│ pattern drill + blind mock in a two-column row                              │
└────────────────────────────────────────────────────────────────────────────┘
```

/problems
```
┌────────────────────────────────────────────────────────────────────────────┐
│ filter row + export                                                         │
├────────────────────────────────────────────────────────────────────────────┤
│ sticky header, dense rows, hairline dividers, tabular numbers              │
│ rows like spreadsheet; no card borders                                      │
└────────────────────────────────────────────────────────────────────────────┘
```

/patterns
```
┌────────────────────────────────────────────────────────────────────────────┐
│ pattern mastery heatmap                                                       │
│ 25 cells, one hue ramp, labels secondary, position carries meaning          │
│ detail pane below for the selected pattern                                   │
└────────────────────────────────────────────────────────────────────────────┘
```

## 4) Principles

- Chrome is neutral; colour is data.
- Surfaces earn borders; most blocks are spacing-driven groups.
- Dense surfaces should read like a notebook, not a marketing site.
- Use one deliberate accent at most; the pattern grid is the place for boldness.

## 5) Self-critique before building

A generic dark developer dashboard would usually lead to:
- bright green accents everywhere
- boxed cards with equal radius
- all-caps eyebrow labels
- a single accent colour sprayed across chrome

This plan deliberately avoids those defaults. The pattern heatmap is the only place with strong visual intensity. Cartographic cues, not decorative tinting, do the work.

This is what changes the system from generic to specific: it treats the interface as a memory tool, not a product launch page.
