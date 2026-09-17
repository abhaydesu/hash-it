# Design pass report

## Component inventory

| File | Before | After |
|------|--------|-------|
| `components/ui/sheet-section.tsx` | Incomplete; band `display:none` | Full-bleed hairline + dither bands (`none`/`neutral`/`dense`/`accent`/`hero`) |
| `components/ui/spec-sheet.tsx` | Partial | SpecCell / SpecGrid / FigureCaption with orange fig mark |
| `components/ui/button.tsx` | Filled semantic outcomes | `primary`/`secondary`/`ghost` + outlined outcome set |
| `components/ui/badge.tsx` | Inconsistent fills | Quiet border+text variants by meaning |
| `components/ui/input.tsx` | Neutral focus | Orange focus ring |
| `components/ui/select.tsx` | Neutral focus | Orange focus ring |
| `components/ui/loader.tsx` | Spinner export | `PageSkeleton` + dither loaders; Spinner removed |
| `components/navbar.tsx` | Mixed | SheetSection nav; orange active state; orange sign-in |
| `components/recall-card-item.tsx` | Mono, arrows, double borders | Sheet surface, outcome buttons, sentence case |
| `components/review-card-item.tsx` | Filled outcome chrome, mono | Quiet outcomes, shared surface |
| `components/problem-grid/data-table.tsx` | Mono filters, cell+table double borders | Spreadsheet density; orange selected filters; hairline rows only |
| `components/problem-grid/columns.tsx` | Filled difficulty | Quiet difficulty chips |
| `components/roadmap/roadmap-client.tsx` | Nested bordered boxes | Hairline panels, sentence case |
| `components/command-bar.tsx` | Legacy boxed controls | **Not fully restyled** — large surface; still functional; deferred to avoid logic risk in save paths |
| `components/keyboard-shortcuts-modal.tsx` | Shadow card | **Not restyled** — low traffic overlay |
| `components/theme-toggle.tsx` | OK | Unchanged |
| `components/user-menu.tsx` | Shadow menu | Unchanged (initials `.toUpperCase` kept — not presentational caps) |
| `components/schedule-review-toggle.tsx` | One-off button | **Not restyled** |
| `components/logo.tsx` | Clean | Unchanged |
| `components/theme-provider.tsx` | Clean | Unchanged |
| `components/today-page-actions.tsx` | Thin | Unchanged |

## Page status

| Page | Status |
|------|--------|
| `/today` | Done |
| `/problems` | Done |
| `/patterns` | Done — mastery uses `dither-mastery-0…4` |
| `/review/weekly` | Done — retrievability as SpecCell |
| `/review/monthly` | Done |
| `/stats` | Done |
| `/import` | Done |
| `/settings` | Done |
| `/` landing | Done — hero dither band, accent links |
| `/problems/[id]` | Done |
| `/roadmap` | Client restyled; server page data-only |
| `/auth/signin` | Light pass (labels, focus) |

## Final tokens

See `DESIGN.md`. Summary:

- Paper: cool off-white `50 8% 97%` / dark `30 6% 8%`
- Orange 500 signal: light `24 95% 48%`, dark `24 95% 58%`
- Semantic: `--easy` / `--medium` / `--hard` / `--warning` / `--recall` as HSL vars
- Type: Manrope + IBM Plex Mono (code/notes only)
- Dither: `bg-dither-25`, `bg-dither-50`, `bg-dither-orange`, `dither-mastery-0…4`

## Step 3 revision (anti-generic)

Rejected from a default “clean developer dashboard” plan:

- Inter/Geist → kept Manrope
- Purple/indigo accent → saturated orange as decision-only
- Rounded shadowed stat cards → SpecGrid hairline cells
- Colour heatmap on patterns → dither density field
- Full-height margin hatching → narrow dither bands at section rules only
- Pill filter chrome → square orange-selected filters

## Incomplete / deferred

| Item | Reason |
|------|--------|
| `command-bar.tsx` full restyle | Large interactive surface with intertwined save UX; deferred rather than risk behaviour change mid-pass |
| `keyboard-shortcuts-modal.tsx` | Low-priority overlay; still uses a single bordered panel |
| `schedule-review-toggle.tsx` | Small one-off; still works |
| Browser visual QA both themes | No browser session opened in this pass; reasoned from markup and TypeScript. Run `npm run dev` and flip themes on `/`, `/today`, `/patterns`, `/problems` to verify dither contrast and full-bleed crossings. |
| Remaining `font-mono` on kbd / note bodies | Intentional — keys and user-written invariants |

## Commits (this pass)

1. `594cd6d` — primitives, dither, DESIGN.md  
2. `cdef961` — today queue  
3. `744ba9d` — patterns mastery  
4. `af48b43` — weekly + monthly  
5. `fafec95` — stats, import, settings  
6. `eface37` — landing, detail, roadmap  
7. (pending) problems grid + badge fix + signin polish  
