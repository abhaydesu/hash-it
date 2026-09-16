# Hash-It polish report

## Grid audit

- `/`: The shared layout now owns the single center column, so the header, navigation, and landing content use the same vertical rules. The landing page no longer adds a second bordered column. Existing section rules remain local to their section; the full-bleed rule utility is available, but the landing sections still need a browser pass to apply it consistently.
- `/today`: Header, navigation, and content share the center column. The metric row uses one container border with internal dividers. Review cards remain bordered individual work surfaces, which is the intentional exception for actionable queue items. Full-bleed section rules and hatch-band placement still need visual verification.
- `/review/weekly`: Header, navigation, and content share the center column. Weak-pattern drills are one bordered sheet with divided rows rather than a card grid. The untouched-pattern area still uses individual bordered items and should be flattened in a follow-up visual pass.
- `/review/monthly`: Header, navigation, and content share the center column. The assessment and result surfaces remain framed because they contain a single active workflow. Full-bleed rules and child-border flattening need a browser pass.
- `/stats`: Header, navigation, and content share the center column. Metric cells use the spec-sheet grid. The stuck-problem entries are still individually bordered inside a bordered section and should be converted to divided rows.
- `/patterns`, `/problems`, `/roadmap`, `/settings`, `/import`, `/auth/signin`, and problem detail: The shared shell provides continuous vertical rules and aligned header/nav/content edges. Existing page-local panels and section boundaries still require visual review for full-bleed rules and nested borders.

## Color system

- Interaction accent: light `#F97316`; dark `#FB923C`; the full `orange-50` through `orange-900` scale is defined in `tailwind.config.ts` and backed by separate light/dark CSS variables.
- Orange applies to primary actions, active navigation, selected controls, links, focus rings, and checked states.
- Neutral colors remain the default for surfaces, rules, type, and hatching.
- Semantic colors remain separate: easy green, medium blue, hard red, overdue/failure red, and teal recall data.
- Amber was removed from medium difficulty and warning semantics. Medium moved to blue (`#3B82A0`); warnings moved to red (`#B42318`).
- Hatching is documented as a thin horizontal separator treatment. The existing full-height margin hatch in the shared shell still needs removal after a browser review confirms the replacement bands.

## Stats formulas

- Solved without help: `GOOD` or `EASY` attempt ratings divided by all attempt rows for the current user. Imported entries are counted in the denominator only when they have an attempt row. The API now exposes the numerator and denominator so the UI shows `x of y reviews`.
- Problems practised: count of the user's entry rows, including imported entries.
- Typical solve time: median of positive `Entry.minutes` values, grouped by problem difficulty. This is entry-based, not attempt-based.
- Times forgotten per problem: total `ReviewCard.lapses` divided by the number of the user's entries that have a review card. This is an average lapse count, despite the legacy `lapseRate` field name.
- Stuck problems: count of entries whose review card has `lapses >= 3`.
- Recall estimate: FSRS retrievability computed from each review card's stability, scheduled interval, and last review, averaged per pattern on the review/pattern APIs.
- The reported cold-solve percentage is therefore not based on all 104 imported entries unless those entries also have attempt rows. A displayed `27%` against `15` attempts is internally consistent with the current query when four of those attempts are `GOOD`/`EASY`; it is not an entry-rate denominator.

## Uppercase audit

- No `uppercase` CSS utility remains in the application source.
- `components/user-menu.tsx` retains two `toUpperCase()` calls solely to normalize generated avatar initials; this is not presentation styling and is the only source-code exception.
- Internal enum/status strings such as `SOLVED_UNAIDED`, `EASY`, and `GOOD` remain in code and API contracts, but are not presentation copy. They are intentionally mapped to sentence-case labels in the UI.
- Generated `.next` output still contains framework/library `uppercase` and `toUpperCase` strings; it is ignored build output and is not application source.

## Validation

- `npm test -- --run`: 21 tests passed; `tests/auth.test.ts` is blocked by the existing Next/NextAuth ESM resolution error (`next/server`).
- `npx tsc --noEmit`: the weekly JSX and polish changes compile; two existing auth/test errors remain in `lib/auth.ts` and `tests/auth.test.ts`.
- Browser screenshots were not captured because no browser automation tool is available in this environment.
