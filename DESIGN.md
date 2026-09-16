# Hash-It Design System

## 1. Identity & Concept

**Concept:** A technical drafting sheet or spec-sheet. Hash-It is an instrument for measuring recall, and the interface honestly expresses that with a stark, structured, and precise layout.
**Reference:** Inspired by `chanhdai.com`.

### Core Rules:
1. **The Grid:** A fixed center column with vertical rules running the full height of the page, on both sides, unbroken from header to footer.
2. **Hairline Separators:** Horizontal rules extend edge to edge past the content column. Sections are separated by full-bleed lines, not by gaps or boxed cards.
3. **Margins:** Empty or lightly hatched (diagonal stripe fills) to mark dead space as deliberate.
4. **Metadata as Spec-Sheet Cells:** Grids of small labelled cells divided by hairlines (no rounded borders).
5. **Figure Captions:** Use "Fig. 1", "Fig. 2" beneath diagrams and data visuals (technical-drawing vernacular).

## 2. Palette

Chrome is mostly neutral, with orange reserved for interaction and decisions. Semantic colors remain reserved for data meaning.

Neutral ramp (Light / Dark to be mapped to Tailwind tokens, e.g. `zinc-900`/`zinc-100`):
- Line (Hairlines, Borders)
- Muted (Labels, Captions)
- Ink (Primary Text, Headings)

Interaction accent:
- Light orange: `#F97316`; dark orange: `#FB923C`.
- The complete `orange-50` through `orange-900` scale is defined in `tailwind.config.ts`.
- Use orange for primary actions, active navigation, selected controls, links, focus rings, and checked states. Keep it on small decisive elements, not broad fills.

Semantic data colors:
- Difficulty: easy green, medium amber, hard red. Badges are quiet border/text treatments without fills.
- Overdue and failure: warning red.
- Recall estimate: teal retrieval ramp.
- Orange never encodes data meaning. Warnings and failures remain red; medium difficulty retains muted amber for recognizability.

*Green is stripped from all chrome. It only survives as an outcome indicator.*

## 3. Typography

- **Headings:** Large, generous whitespace. **Sentence-case only.** (Never ALL_CAPS `SNAKE_CASE`).
- **Body & Labels:** Sans-serif (Manrope/Inter).
- **Data:** Tabular figures for aligned numbers (`tabular-nums`).
- **Mono:** Reserved *strictly* for code and user-written invariants. Not used for labels, stat values, or buttons.

## 3.1 Structural rules

- A bordered container owns its border; bordered children use hairline dividers instead.
- Hatching appears only in thin horizontal separator bands. Page margins stay plain.
- Section rules run full-bleed through the center column and past its vertical rules.

## 4. Component Primitives

- **Buttons:** Three strict variants: Primary (solid neutral), Secondary (outline neutral), Ghost (no border). Outcome buttons are a distinct semantic group.
- **Form Controls:** Unified input, select, and focus rings (neutral, structural).
- **Badges:** One configurable component driven by semantic data.
- **Loaders:** Structural skeletons or a restrained indicator. No spinners with all-caps text.
- **Cards:** No boxed, floating elements with rounded borders. Rendered flat against the drafting sheet with hairline dividers.

## 5. Layout Concept (ASCII Wireframes)

### / (landing)
```text
========================================================================
|   [empty/hatch]   | HASH-IT                            |             |
------------------------------------------------------------------------
|                   | A practice log for LeetCode that   |             |
|                   | decides when to re-solve...        |             |
|                   |                                    |             |
|                   | [ Mockup of review queue ]         |             |
|                   | Fig 1. Daily review queue.         |             |
------------------------------------------------------------------------
|                   | The Problem                        |             |
|                   | Spreadsheets fade...               |             |
------------------------------------------------------------------------
|                   | Colophon (Spec-sheet cells)        |             |
|                   | ┌──────┬──────┬──────┐             |             |
|                   | │ Tech │ Repo │ Font │             |             |
|                   | └──────┴──────┴──────┘             |             |
========================================================================
```

### /today
```text
========================================================================
|   [empty/hatch]   | Today's Queue                      |             |
------------------------------------------------------------------------
|                   | ┌─────────┬─────────┬─────────┐    |             |
|                   | │ To Do   │ Overdue │ Learned │    |             |
|                   | └─────────┴─────────┴─────────┘    |             |
------------------------------------------------------------------------
|                   | RECALL                             |             |
|                   | Problem 1                          |             |
|                   | ---------------------------------- |             |
|                   | Problem 2                          |             |
------------------------------------------------------------------------
|                   | RESOLVE                            |             |
|                   | Problem 3                          |             |
========================================================================
```
