# Hash-It polish pass 2

## 1. Full-bleed rules

- Done: `SheetSection` is the shared section primitive. Its wrapper owns the hairline and its pseudo-element extends the rule to `100vw`, crossing the center column’s vertical rules.
- Done: the shared header and navigation use `SheetSection`, so their boundary rules are no longer owned by the column-width content element.
- Done: landing page sections use `SheetSection`.
- Done: `/today`, `/review/weekly`, `/review/monthly`, `/stats`, `/patterns`, and `/settings` use `SheetSection` for their major page blocks.
- Not done: `/import`, `/problems`, problem detail, `/roadmap`, and sign-in still use legacy page-local boundaries. Reason: those pages were not converted before the validation pass; their rules remain content-column width and require the same wrapper conversion.
- Not done: some nested form/content blocks on `/settings` and the active queue cards on `/today` retain legacy local borders. Reason: they are not yet all expressed through the container-plus-divider pattern.

## 2. Dither identity motif

- Done: diagonal hatch utilities and the full-height margin hatch are removed.
- Done: neutral ordered-dither utilities exist at two densities, plus an orange accent dither utility. They are static CSS gradients, work in both themes through CSS tokens, and do not animate.
- Done: landing hero, queue figure ground, entry sample ground, section bands, pattern mastery grid, loading placeholders, empty states, and stats mistake empty state use dither.
- Done: mastery density is tied to recall level: stronger recall uses the lighter field and weaker recall uses the denser field.
- Not done: `/import`, `/problems`, problem detail, `/roadmap`, and sign-in do not yet use dithered loading/empty states. Reason: those pages still use their existing local surfaces and were outside the converted section blocks.

## 3. Weekly drill persistence

- Done: added `PatternDrill { id, userId, patternId, at, correct }` with user and pattern relations and an index for latest-drill lookup.
- Done: applied the additive schema change with `prisma db push` and regenerated Prisma Client.
- Done: weekly API reads the latest `PatternDrill` for each pattern. `isUntouched14Days` is now based on the latest drill, not problem attempts.
- Done: revealing asks “Did you name it?” with Yes/No controls. Both answers write a `PatternDrill` record through `/api/review/weekly/drill`; neither path mutates `ReviewCard` or FSRS.
- Done: a correct answer is excluded from the next weekly below-target list; an incorrect answer remains eligible.
- Done: `/patterns` exposes and displays each pattern’s last drilled date.
- Done: answer feedback is shown inline as “Answered — [pattern]” before the page refreshes its list.

## 4. Weekly vocabulary and retention

- Done: title is “Pattern recognition drill”.
- Done: subtitle is “Read the description, name the technique. Tests recognition, not implementation.”
- Done: target copy reads from `UserSettings.desiredRetention` as “you should recall N in 10”. The API fallback is the schema default `0.80`, not `0.85`.
- Done: summary labels use “need review”, “not practised in 2 weeks”, “solid”, and “never practised”.
- Done: the redundant “requiring reinforcement” count is removed.
- Done: recall estimates use a non-wrapping value cell with the label above it.

## 5. Difficulty colors

- Done: difficulty uses the familiar green/amber/red convention again. Medium is `#A98245`.
- Done: difficulty badges are quiet border/text treatments without fills, so they do not compete with saturated orange controls.
- Done: overdue and failure semantics remain red.
- Rationale: difficulty is read frequently against LeetCode’s established green/amber/red convention; reducing badge weight resolves the interaction-color collision without making medium blue.

## 6. Remaining items

- Done: the authenticated landing primary action says “Open your queue” and no arrow is appended.
- Done: landing hero, figure ground, section bands, dither emphasis, sample overdue state, and orange interaction links provide more than one accent signal while keeping orange out of semantic overdue styling.
- Partially done: nested borders were flattened in weekly untouched-pattern rows, stats stuck-problem rows, monthly protocol/active-work surfaces, and the weekly drill list. Reason remaining: `/today` queue cards and some settings/import/problem surfaces still have bordered children inside bordered containers.
- Done: no full-height hatch remains in the shared shell.

## Validation

- `npx prisma db push`: passed; database schema is synchronized and Prisma Client regenerated.
- `npm test -- --run`: 21 tests passed. The auth suite remains blocked by the existing Next/NextAuth ESM resolution error involving `next/server`.
- `npx tsc --noEmit`: new polish and PatternDrill code typecheck; two pre-existing auth/test errors remain in `lib/auth.ts` and `tests/auth.test.ts`.
- `git diff --check`: passed.
- Browser rendering was not available in this environment. Rendered behavior was reasoned from the shared markup/CSS and executable checks; the unresolved items above are explicitly marked not done rather than deferred as visual verification.
