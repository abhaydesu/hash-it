# Redesign recap

## Final token values

Chrome:
- Paper: #F8F5F1
- Panel: #F3EEE7
- Surface: #FAF8F4
- Border: #D7CEC0
- Muted: #8E847B
- Ink: #1E1A17
- Background (dark mode): #12100E

Data colour system:
- Easy: #7C9E74
- Medium: #C38B4C
- Hard: #B85C4A
- Cold / failed: #B85C4A
- Hint / review: #8E7A63
- Overdue: #C07F3C
- Retrieval ramp: #E3D8C7 → #CBB69B → #A77B57 → #6F4A35

## Typeface choice and why

- Sans: Manrope
- Mono: IBM Plex Mono

Manrope gives the product a more deliberate editorial tone than default SaaS sans while remaining readable in a dense study interface. IBM Plex Mono is reserved for data-like metadata, counts, and short labels that need to feel precise. The visual language is intentionally less “startup” and more “memory lab notebook.”

## What changed after the self-critique

The original pass was too close to a generic dev dashboard: green accents were repeated as decorative chrome, the same card treatment was used everywhere, and the eye was being pulled toward shimmery UI rather than the actual signal. The revision corrected that by:

- making the shell neutral and quiet instead of high-contrast
- reserving colour for retrieval, difficulty, and failure meaning
- reducing the number of accent moments so the pattern heatmap reads as the main expressive surface
- removing the dead gutter and redundant UI framing from the daily review view
- keeping the landing page more editorial and less product-launch driven

In other words, the redesign stopped treating the interface as a generic dashboard and instead treated it like a memory instrument with a clearly different public vs private experience.

## Public vs internal surfaces

The system is intentionally split into two distinct design behaviors:

1. Public landing surface
   - warm-paper editorial treatment
   - more breathing room and longer-form explanation
   - fewer UI wrappers and less chrome
   - CTA designed to feel calm and deliberate

2. Protected app surface
   - denser, data-first layout
   - still muted chrome, but more efficient and compact
   - information hierarchy driven by spacing and type weight, not by repeated boxes
   - focus on queue, pattern and problem data rather than decoration

## Final note on screenshots

This environment does not expose a browser capture workflow for reliable before/after screenshots, so no screenshot artifacts were produced here. The visual direction was nonetheless locked to the stated design rule: neutral chrome, colour as data, and clear differentiation between the landing and app experiences.
