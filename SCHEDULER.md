## 1. Fixed first intervals

`DEFAULT_FIRST_INTERVALS` is cold 14, hint 10, solution 7, flagged 4 (`lib/scheduler.ts:47-52`). The flag wins over the rating (`lib/scheduler.ts:65`). `FACTOR` and `DECAY` are imported from the installed `ts-fsrs` (`lib/scheduler.ts:7-8`). Stability is `S = FACTOR * t / (R^(1/DECAY) - 1)` (`lib/scheduler.ts:94-96`). `seedCard` keeps FSRS difficulty, then sets stability, `scheduledDays` from `next_interval`, and `due` from that (`lib/scheduler.ts:346-358`).

The 3-day seed floor is gone. On a later `Again`, only the 2-day floor remains (`lib/scheduler.ts:44`, `lib/scheduler.ts:361-366`, `lib/scheduler.ts:394-396`).

Seeded at retention 0.8, clock `2026-10-08T00:00:00.000Z`:

```
solved cold {"due":"2026-10-22T00:00:00.000Z","stability":5.838134430727026,"scheduledDays":14,"reps":1,"state":"REVIEW"}
used hint {"due":"2026-10-18T00:00:00.000Z","stability":4.170096021947875,"scheduledDays":10,"reps":1,"state":"REVIEW"}
saw solution {"due":"2026-10-15T00:00:00.000Z","stability":2.919067215363513,"scheduledDays":7,"reps":1,"state":"REVIEW"}
flagged cold {"due":"2026-10-12T00:00:00.000Z","stability":1.66803840877915,"scheduledDays":4,"reps":1,"state":"REVIEW"}
```

A logged `ATTEMPTED_FAILED` row from the integration test has `scheduledDays` 7 and `reps` 1. A logged flagged cold solve has `scheduledDays` 4. Both assertions passed in `tests/integration/scheduler-lanes.test.ts`.

The stability round-trip (every first interval, retention 0.7, 0.8, 0.9, ±1 day) passed in `tests/unit/scheduler-first-intervals.test.ts`.

```
grep -n "prisma" lib/scheduler.ts
```

No matches. Exit code 1.

## 2. Lane routing

"Never reviewed" is `Attempt.lane`, not `reps` or `lastReview`. Seeding sets `reps` to 1 and `lastReview` to now, so those cannot mean a queue review. A log leaves `lane` null. A queue review sets it to `RECALL` or `RESOLVE`.

```188:191:lib/scheduler.ts
/** Queue reviews set Attempt.lane. A log leaves it null, so reps/lastReview cannot mean "reviewed". */
export function hasQueueReview(attempts: Array<{ lane: ReviewLane | null }>): boolean {
  return attempts.some((attempt) => attempt.lane != null);
}
```

No `Attempt.source` enum. The failed-recall marker is the existing attempt: latest `RECALL` + `AGAIN`, newer than the latest cold solve (`GOOD` or `EASY` with `lane !== RECALL`) (`lib/scheduler.ts:193-206`). A later cold solve clears it by being newer. `recordRecallAttempt` writes `lane: "RECALL"` (`app/actions/entry-actions.ts:547`).

The flag is checked before "never reviewed". A flagged card is a re-solve even on its first due date. That is the section 3 override; the numbered list in the request put never-reviewed first.

```167:179:lib/scheduler.ts
export function deriveLane(item: {
  /** At least one attempt was logged from the queue (Attempt.lane set). */
  reviewed?: boolean;
  revisit?: boolean;
  lapses?: number;
  /** Latest failed recall is newer than the latest cold solve. */
  failedRecall?: boolean;
}): ReviewLane {
  if (item.revisit) return "RESOLVE";
  if (!item.reviewed) return "RECALL";
  if ((item.lapses ?? 0) >= 2) return "RESOLVE";
  if (item.failedRecall) return "RESOLVE";
  return "RECALL";
}
```

Due cards on 2026-10-07T21:25:25.756Z, old rule (either of the two most recent ratings `AGAIN` or `HARD`, or stability under 30) versus `deriveLane`:

```
{
  "due": 118,
  "now": "2026-10-07T21:25:25.756Z",
  "old": { "RESOLVE": 118, "RECALL": 0 },
  "new": { "RESOLVE": 51, "RECALL": 67 }
}
```

Of those 118, the new lane breaks down as revisit 50, never queue-reviewed 66, lapses ≥ 2: 0, failed recall 1, clean 1.

Caps, overdue-before-due ordering, lapse tiebreak, pattern-family interleaving, Resolve-before-Recall, and the overdue promotion of resolve cards are unchanged (`lib/dashboard.ts:99-100`, `lib/dashboard.ts:169-180`). Recall cap stays 3 (`lib/dashboard.ts:6`).

## 3. Make the revisit flag real

On a new log, `seedCard` receives `flagged: data.revisit` and the user's intervals (`app/actions/entry-actions.ts:185-186`). Flagging a card that already exists pulls `due` in to the flagged interval when that date is sooner, and does not push a nearer date out (`app/actions/entry-actions.ts:190-196`, `app/actions/entry-actions.ts:617-628`). A cold solve on a review sets `entry.revisit` to false (`app/actions/entry-actions.ts:466` and `app/actions/entry-actions.ts:470-471`). Flagged cards use the same resolve cap (`lib/dashboard.ts:99`).

Rolled-back row, same pull the action applies (stability left as seeded):

```
before {"revisit":false,"due":"2026-10-21T21:29:58.840Z","scheduledDays":14,"stability":5.838134430727026}
after {"revisit":true,"due":"2026-10-11T21:29:58.840Z","scheduledDays":4,"stability":5.838134430727026}
rolled back
```

The integration test logs with `revisit: true`, asserts `scheduledDays` 4, records a cold solve through `recordReviewAttempt`, and asserts `revisit` is false. That test passed.

## 4. Settings

`UserSettings` columns, defaults 14 / 10 / 7 / 4 (`prisma/schema.prisma:192-195`). Migration `20261008000000_first_intervals` adds them and does not update review cards. `npx prisma migrate deploy` applied that migration. `updateUserSettings` accepts the four fields with those defaults (`app/actions/settings-actions.ts:27-30`). New logs and the flag pull read them through `firstIntervalsFrom` (`lib/scheduler.ts:71-85`).

Help text on `/settings`, inside the existing schedule block (`components/settings-client.tsx:157-160`):

> How long a newly logged problem waits before its first review, set by how the solve went — longer waits mean fewer reviews competing with new problems, and changing these does not move problems already logged.

The settings page showed Solved cold 14, Used hint 10, Saw solution 7, Flagged 4. Saving Solved cold as 15 wrote `firstIntervalCold: 15` for jake@hashit.local. It was saved back to 14. Confirmed:

```
{"firstIntervalCold":14,"firstIntervalHint":10,"firstIntervalSolution":7,"firstIntervalFlagged":4,"dailyResolveCap":2}
```

## 5. Tests

`tests/unit/scheduler-first-intervals.test.ts` uses the fixed clock `2026-10-08T00:00:00.000Z`. It checks each outcome's first interval ±1 day, the flag overriding each outcome, the stability round-trip at retention 0.7, 0.8 and 0.9, `Again` matching FSRS except for the 2-day floor (and not a forced 3), never-reviewed recall for every rating including `AGAIN`, flagged resolve, `lapses >= 2` resolve, failed-recall resolve cleared by a later cold solve, a clean reviewed card on recall, and a card whose stability is under 30 with a clean history on recall.

`tests/integration/scheduler-lanes.test.ts` logs a saw-solution entry, finds it in the daily queue as `RECALL`, fails that recall, and finds the next due queue item as `RESOLVE`. The second test clears `revisit` on the next cold solve.

An older assertion still required `scheduledDays >= 3` after `Again` and failed with `expected 2 to be greater than or equal to 3`. It now expects `>= 2` (`tests/integration/user-loops.test.ts:116-117`). The weekly overdue fixture had no queue attempt, so the new rule already called it recall and the promotion exception never set `retryTomorrow`. It is now a reviewed card with 2 lapses, which is resolve, and the promotion still lifts it.

## 6. Report

`npx vitest run` after those two assertion updates:

```
npm warn Unknown env config "devdir". This will stop working in the next major version of npm. See `npm help npmrc` for supported config options.

 RUN  v3.2.7 /Users/abhaysingh/Code/hash-it

 ✓ |integration| tests/integration/auth-local.test.ts (1 test) 6708ms
   ✓ local auth identity > creates distinct local users for different emails  6706ms
 ✓ |unit| tests/unit/auth-get-current-user.test.ts (7 tests) 29ms
stdout | tests/unit/scheduler-intervals.test.ts > scheduler interval sweep > prints the review trajectory table

desiredRetention = 0.8   baselines = easy 20m / medium 40m / hard 60m
Each cell = how long after LOGGING the problem resurfaces, and in which form.
Recall reviews are assumed passed. h = hours, d = days, y = years.

━━ EASY ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  logged as               rating  1st review        2nd review        3rd review        4th review        5th review        
  cold, 10 min            GOOD      14d · quick       97d · quick      1.3y · quick      2.3y · quick      3.3y · quick     
  cold, 20 min            GOOD      14d · quick       97d · quick      1.3y · quick      2.3y · quick      3.3y · quick     
  cold, 30 min            GOOD      14d · quick       97d · quick      1.3y · quick      2.3y · quick      3.3y · quick     
  cold, 40 min            GOOD      14d · quick       97d · quick      1.3y · quick      2.3y · quick      3.3y · quick     
  cold, 50 min            GOOD      14d · quick       97d · quick      1.3y · quick      2.3y · quick      3.3y · quick     
  cold, 60 min            GOOD      14d · quick       97d · quick      1.3y · quick      2.3y · quick      3.3y · quick     
  cold, 75 min            GOOD      14d · quick       97d · quick      1.3y · quick      2.3y · quick      3.3y · quick     
  cold, 90 min            GOOD      14d · quick       97d · quick      1.3y · quick      2.3y · quick      3.3y · quick     
  cold, 120 min           GOOD      14d · quick       97d · quick      1.3y · quick      2.3y · quick      3.3y · quick     
  cold, no time logged    GOOD      14d · quick       97d · quick      1.3y · quick      2.3y · quick      3.3y · quick     
  used hint, 40 min       HARD      10d · quick       60d · quick      278d · quick      1.8y · quick      2.8y · quick     
  solved w/ help, 40 min  HARD      10d · quick       60d · quick      278d · quick      1.8y · quick      2.8y · quick     
  failed                  AGAIN      7d · quick       39d · quick      166d · quick      1.5y · quick      2.5y · quick     

━━ MEDIUM ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  logged as               rating  1st review        2nd review        3rd review        4th review        5th review        
  cold, 10 min            GOOD      14d · quick       97d · quick      1.3y · quick      2.3y · quick      3.3y · quick     
  cold, 20 min            GOOD      14d · quick       97d · quick      1.3y · quick      2.3y · quick      3.3y · quick     
  cold, 30 min            GOOD      14d · quick       97d · quick      1.3y · quick      2.3y · quick      3.3y · quick     
  cold, 40 min            GOOD      14d · quick       97d · quick      1.3y · quick      2.3y · quick      3.3y · quick     
  cold, 50 min            GOOD      14d · quick       97d · quick      1.3y · quick      2.3y · quick      3.3y · quick     
  cold, 60 min            GOOD      14d · quick       97d · quick      1.3y · quick      2.3y · quick      3.3y · quick     
  cold, 75 min            GOOD      14d · quick       97d · quick      1.3y · quick      2.3y · quick      3.3y · quick     
  cold, 90 min            GOOD      14d · quick       97d · quick      1.3y · quick      2.3y · quick      3.3y · quick     
  cold, 120 min           GOOD      14d · quick       97d · quick      1.3y · quick      2.3y · quick      3.3y · quick     
  cold, no time logged    GOOD      14d · quick       97d · quick      1.3y · quick      2.3y · quick      3.3y · quick     
  used hint, 40 min       HARD      10d · quick       60d · quick      278d · quick      1.8y · quick      2.8y · quick     
  solved w/ help, 40 min  HARD      10d · quick       60d · quick      278d · quick      1.8y · quick      2.8y · quick     
  failed                  AGAIN      7d · quick       39d · quick      166d · quick      1.5y · quick      2.5y · quick     

━━ HARD ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  logged as               rating  1st review        2nd review        3rd review        4th review        5th review        
  cold, 10 min            GOOD      14d · quick       97d · quick      1.3y · quick      2.3y · quick      3.3y · quick     
  cold, 20 min            GOOD      14d · quick       97d · quick      1.3y · quick      2.3y · quick      3.3y · quick     
  cold, 30 min            GOOD      14d · quick       97d · quick      1.3y · quick      2.3y · quick      3.3y · quick     
  cold, 40 min            GOOD      14d · quick       97d · quick      1.3y · quick      2.3y · quick      3.3y · quick     
  cold, 50 min            GOOD      14d · quick       97d · quick      1.3y · quick      2.3y · quick      3.3y · quick     
  cold, 60 min            GOOD      14d · quick       97d · quick      1.3y · quick      2.3y · quick      3.3y · quick     
  cold, 75 min            GOOD      14d · quick       97d · quick      1.3y · quick      2.3y · quick      3.3y · quick     
  cold, 90 min            GOOD      14d · quick       97d · quick      1.3y · quick      2.3y · quick      3.3y · quick     
  cold, 120 min           GOOD      14d · quick       97d · quick      1.3y · quick      2.3y · quick      3.3y · quick     
  cold, no time logged    GOOD      14d · quick       97d · quick      1.3y · quick      2.3y · quick      3.3y · quick     
  used hint, 40 min       HARD      10d · quick       60d · quick      278d · quick      1.8y · quick      2.8y · quick     
  solved w/ help, 40 min  HARD      10d · quick       60d · quick      278d · quick      1.8y · quick      2.8y · quick     
  failed                  AGAIN      7d · quick       39d · quick      166d · quick      1.5y · quick      2.5y · quick     


 ✓ |unit| tests/unit/scheduler-intervals.test.ts (26 tests) 21ms
 ✓ |unit| tests/unit/middleware.test.ts (8 tests) 19ms
 ✓ |unit| tests/unit/weekly-review.test.ts (21 tests) 16ms
 ✓ |unit| tests/unit/greeting-and-week-label.test.ts (6 tests) 13ms
 ✓ |unit| tests/unit/custom-fields.test.ts (15 tests) 10ms
 ✓ |unit| tests/unit/scheduler.test.ts (60 tests) 11ms
 ✓ |unit| tests/unit/formatters-and-helpers.test.ts (37 tests) 7ms
 ✓ |unit| tests/unit/import-csv.test.ts (21 tests) 7ms
 ✓ |unit| tests/unit/env-auth.test.ts (1 test) 5ms
 ✓ |unit| tests/unit/csv-matching.test.ts (17 tests) 5ms
 ✓ |unit| tests/unit/scheduler-first-intervals.test.ts (20 tests) 5ms
 ✓ |unit| tests/unit/scheduler-basics.test.ts (17 tests) 5ms
 ✓ |unit| tests/unit/monthly-mock-set.test.ts (8 tests) 4ms
stdout | tests/integration/auth-matrix.test.ts > Authorization Matrix (Integration) > prevents User A from modifying User B's entry data (cross-user isolation)
prisma:error 
Invalid `prisma.entry.findFirstOrThrow()` invocation in
/Users/abhaysingh/Code/hash-it/app/actions/entry-actions.ts:689:36

  686 export async function toggleScheduleReview(entryId: string, schedule: boolean) {
  687   const user = await getCurrentUser();
  688   const id = z.string().max(64).parse(entryId);
→ 689   const entry = await prisma.entry.findFirstOrThrow(
An operation failed because it depends on one or more records that were required but not found. No record was found for a query.

 ✓ |unit| tests/unit/stats.test.ts (7 tests) 4ms
stdout | tests/unit/practice-grid.test.ts > packPatternGrid > fills every 5-column row with no gaps
Basics | Two Pointer | Fast and Slow Pointer | Sliding Window | Merge Intervals
Prefix Sum | Kadane's Pattern | In-place Reversal of LinkedList | Dummy Node | Stack
HashMap | Heap | Binary Search | Backtracking ×2
BFS ×2 | DFS ×2 | Topological Sort
Dynamic Programming ×2 | Greedy | Trie | Union Find
Bit Manipulation | Matrix Traversal ×2 | Monotonic Stack ×2

 ✓ |unit| tests/unit/practice-grid.test.ts (2 tests) 3ms
 ✓ |unit| tests/unit/auth-config.test.ts (6 tests) 3ms
 ✓ |unit| tests/unit/pattern-match.test.ts (7 tests) 3ms
 ✓ |unit| tests/unit/roadmap-access.test.ts (2 tests) 2ms
 ✓ |unit| tests/unit/auth.test.ts (5 tests) 3ms
 ✓ |unit| tests/unit/pattern-classifier.test.ts (6 tests) 3ms
 ✓ |integration| tests/integration/monthly-review-route.test.ts (2 tests) 10560ms
   ✓ GET /api/review/monthly > only draws problems from patterns the user has logged  8487ms
   ✓ GET /api/review/monthly > returns nothing for a user who hasn't logged anything  2071ms
 ✓ |integration| tests/integration/api-routes.test.ts (3 tests) 10831ms
   ✓ API Routes (Integration) > enforces authentication on all user-scoped API endpoints  2399ms
   ✓ API Routes (Integration) > returns user-scoped dashboard and review data when authenticated  8430ms
 ✓ |component| tests/component/import-wizard.test.tsx (7 tests) 398ms
 ✓ |component| tests/component/monthly-mock.test.tsx (4 tests) 984ms
   ✓ MonthlyMockProvider and NavControls > times each problem on its own, not from the start of the session  337ms
 ✓ |component| tests/component/command-bar.test.tsx (8 tests) 1574ms
   ✓ CommandBar > searches and displays results  374ms
   ✓ CommandBar > allows selecting a problem and logging it  390ms
   ✓ CommandBar > suggests existing patterns while typing a pattern tag and selects one on click  394ms
   ✓ CommandBar > handles manual entry form if no results found  382ms
 ✓ |component| tests/component/log-extra-fields.test.tsx (6 tests) 213ms
stdout | tests/integration/auth-matrix.test.ts > Authorization Matrix (Integration) > prevents User A from modifying User B's entry data (cross-user isolation)
prisma:error 
Invalid `prisma.entry.findFirstOrThrow()` invocation in
/Users/abhaysingh/Code/hash-it/app/actions/entry-actions.ts:363:36

  360 const user = await getCurrentUser();
  361 const data = RecordReviewSchema.parse(input);
  362 
→ 363 const entry = await prisma.entry.findFirstOrThrow(
An operation failed because it depends on one or more records that were required but not found. No record was found for a query.

 ✓ |component| tests/component/problem-grid.test.tsx (6 tests) 286ms
 ✓ |component| tests/component/simple-components.test.tsx (8 tests) 154ms
 ✓ |component| tests/component/layout-components.test.tsx (8 tests) 127ms
stdout | tests/integration/auth-matrix.test.ts > Authorization Matrix (Integration) > prevents User A from modifying User B's entry data (cross-user isolation)
prisma:error 
Invalid `prisma.entry.findFirstOrThrow()` invocation in
/Users/abhaysingh/Code/hash-it/app/actions/entry-actions.ts:496:36

  493 const user = await getCurrentUser();
  494 const data = RecordRecallSchema.parse(input);
  495 
→ 496 const entry = await prisma.entry.findFirstOrThrow(
An operation failed because it depends on one or more records that were required but not found. No record was found for a query.

 ✓ |component| tests/component/settings-form.test.tsx (3 tests) 136ms
 ✓ |component| tests/component/card-components.test.tsx (5 tests) 107ms
 ✓ |component| tests/component/weekly-plan-items.test.tsx (3 tests) 87ms
 ✓ |component| tests/component/faq-list.test.tsx (3 tests) 135ms
 ✓ |component| tests/component/ui-components.test.tsx (7 tests) 79ms
 ✓ |component| tests/component/keyboard-shortcuts-modal.test.tsx (5 tests) 70ms
 ✓ |integration| tests/integration/monthly-mock.test.ts (4 tests) 15685ms
   ✓ Monthly mock (Integration) > credits the first mock to this month and locks until next month's last day  6612ms
   ✓ Monthly mock (Integration) > records a session once, even if completion is sent again  2519ms
   ✓ Monthly mock (Integration) > won't let one user replay another user's session id  2268ms
   ✓ Monthly mock (Integration) > saves wrap-up notes only on the caller's own entries, leaving untouched fields alone  4284ms
 ✓ |integration| tests/integration/scheduler-lanes.test.ts (2 tests) 19703ms
   ✓ first review then a failed recall > logs into a recall check, and a failed recall comes back as resolve  13880ms
   ✓ first review then a failed recall > clears the revisit flag on the next cold solve  5820ms
 ✓ |integration| tests/integration/custom-fields.test.ts (3 tests) 21679ms
   ✓ Custom fields (Integration) > imports a user's own sheet: maps headers, creates typed fields, stores values  12777ms
   ✓ Custom fields (Integration) > dry-run without a name or link column is rejected  812ms
   ✓ Custom fields (Integration) > log + edit: values are validated against the user's defs and other users' ids are ignored  8087ms
 ✓ |integration| tests/integration/user-loops.test.ts (7 tests) 43339ms
   ✓ User Loops (Integration) > completes full log problem loop with initial card scheduling and attempt creation  7421ms
   ✓ User Loops (Integration) > handles review outcome pass and fail transitions  9060ms
   ✓ User Loops (Integration) > logs a fast first solve as GOOD, not EASY  3168ms
   ✓ User Loops (Integration) > records quick recall rating and updates card  5016ms
   ✓ User Loops (Integration) > returns a blank promoted recall to the full-solve lane tomorrow  4139ms
   ✓ User Loops (Integration) > performs end-to-end CSV import with matching, duplicates resolution, and schedule spread  9972ms
   ✓ User Loops (Integration) > updates user settings and retention parameters correctly  4559ms
 ✓ |integration| tests/integration/weekly-review.test.ts (5 tests) 54007ms
   ✓ Weekly review (Integration) > keeps the daily quick-recall total at three even as passed cards leave the queue  16777ms
   ✓ Weekly review (Integration) > picks weak problems, keeps weekly misses out of the FSRS schedule, and shows a next-day recall  17098ms
   ✓ Weekly review (Integration) > commits a plan and marks items done once attempted  13722ms
   ✓ Weekly review (Integration) > rejects a REDO pick the user never logged  2376ms
   ✓ Weekly review (Integration) > is read-only between Tuesday and Saturday  4031ms
 ✓ |integration| tests/integration/auth-matrix.test.ts (8 tests) 54483ms
   ✓ Authorization Matrix (Integration) > rejects unauthorized access when no session is present  2423ms
   ✓ Authorization Matrix (Integration) > rejects unauthenticated requests to every user-scoped API handler  539ms
   ✓ Authorization Matrix (Integration) > prevents User A from modifying User B's entry data (cross-user isolation)  12434ms
   ✓ Authorization Matrix (Integration) > keeps settings and import batches isolated between users  7224ms
   ✓ Authorization Matrix (Integration) > API handlers only return the authenticated user's data  13069ms
   ✓ Authorization Matrix (Integration) > id-addressed problem detail returns not-found for another user's entry  2136ms
   ✓ Authorization Matrix (Integration) > sign-in by a new user inherits no existing records  6109ms
   ✓ Authorization Matrix (Integration) > allows User A to modify own data successfully  10544ms

 Test Files  43 passed (43)
      Tests  407 passed (407)
   Start at  02:59:22
   Duration  55.76s (transform 636ms, setup 1.44s, collect 5.80s, tests 241.52s, environment 3.31s, prepare 1.43s)

EXIT:0
```

## Daily new problems these caps can hold

The account on `ROADMAP_EMAILS`, sketchologistabhay@gmail.com, has `dailyResolveCap` 1. The recall cap is 3 and is not a setting (`lib/dashboard.ts:6`).

An unflagged new problem's first review is a recall, so it takes a recall slot, not the resolve slot. In steady state one new problem a day produces one first review a day. Three recall slots therefore hold 3 new problems a day. The resolve slot stays for a flagged problem, a second lapse, or a failed recall. It does not add a fourth new problem.

At 4 new problems a day, first reviews exceed the recall cap by 1 a day, and that backlog grows. The resolve cap of 1 is not what absorbs them.
