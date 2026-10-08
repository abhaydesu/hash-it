# VERIFY

## 1. Test database isolation

**Finding: the premise did not hold. Tests were already isolated, and the 675 entries are real users' data.**

`vitest.config.ts` defines three projects. `unit` (node) and `component` (jsdom) never touch a database. `integration` loads `tests/setup/integration-env.ts` first, which rewrites `DATABASE_URL` to the `test_hash_it` schema on the direct (non-pooler) Neon host (`tests/setup/integration-env.ts:13-18`). `tests/setup/integration.ts` refuses to run unless the schema is `test_hash_it` and the host is not `-pooler`. Every integration test wraps its work in `runInTestTransaction`, which always throws `__TEST_ROLLBACK__` (`tests/helpers/test-db.ts`).

Row counts after many full suite runs today:

```
public        [ { users: 17, entries: 675 } ]
test_hash_it  [ { users: 0,  entries: 0   } ]
```

Added `tests/integration/test-isolation.test.ts`: it asserts the schema is `test_hash_it`, creates a user inside `runInTestTransaction`, then confirms `prisma.user.findUnique` returns null after the transaction. It passes.

Accounts in the app schema (`public`):

```
email                              entries oauth  first..last firstSolvedAt
heyabhaysingh21@gmail.com          173     1      2026-08-02..2026-10-01
sketchologistabhay@gmail.com       148     1      2026-09-28..2026-10-08
b99captainjakeperalta@gmail.com    125     1      2026-09-28..2026-09-28
adhishshukla12@gmail.com           124     1      2026-05-19..2026-09-17
jsamuelp181@gmail.com               88     1      2026-01-23..2026-09-28
kushu123456789@gmail.com            14     1      2024-12-23..2026-09-18
pushtisonawala786@gmail.com          2     1      2026-09-19..2026-09-19
e2e-tester@example.com               1     0      2026-09-17
jake@hashit.local, dev@hashit.local, alice@example.com, bob@example.com,
dev-user-local@example.com                 0 entries, no OAuth
angelicasingh2004@gmail.com, pushti@layovered.com, abhaysingh2115@gmail.com,
pujeradi@gmail.com                         0 entries, OAuth
```

Every account with entries except `e2e-tester` has a linked Google sign-in, so they are real sign-ins, not test fixtures. I can't tell whether `b99captainjakeperalta@gmail.com` (125 entries, all dated 2026-09-28) is a real person or a demo account. That needs the owner's call.

`scripts/purge-test-users.ts` dry run (nothing deleted):

```
CANDIDATE  alice@example.com  entries=0 oauth=0
CANDIDATE  bob@example.com  entries=0 oauth=0
CANDIDATE  dev-user-local@example.com  entries=0 oauth=0
CANDIDATE  dev@hashit.local  entries=0 oauth=0
CANDIDATE  e2e-tester@example.com  entries=1 oauth=0
CANDIDATE  jake@hashit.local  entries=0 oauth=0
(11 other accounts: keep)
6 of 17 accounts would be deleted (cascade removes their entries).
Dry run — nothing deleted. Re-run with --confirm after review.
```

A candidate has no linked OAuth account and an `@example.com`/`@hashit.local` email or a `usr_` id. `--only=a@x.com,b@y.com` narrows deletion further. **`--confirm` was not run; awaiting the owner.**

## 2. First intervals

Constants (`lib/scheduler.ts:47`, `:44`):

```ts
export const DEFAULT_FIRST_INTERVALS = { cold: 14, hint: 10, solution: 7, flagged: 4 } as const;
export const MIN_INTERVAL_DAYS = 2;
```

Stability seeding (`lib/scheduler.ts:94`, applied in `seedCard` at `:319`):

```ts
export function stabilityForInterval(intervalDays: number, desiredRetention: number): number {
  return (FACTOR * intervalDays) / (desiredRetention ** (1 / DECAY) - 1);
}
```

`FACTOR` and `DECAY` are imported from `ts-fsrs` (4.7.1; `0.2345679…` and `-0.5`). **Differed from Part A:** `calculateRetrievability` had its own hardcoded `19/81` and `-0.5`. It now uses the imported constants. In `ts-fsrs` 4.x the decay is a module constant, not an optimizer weight (`w` has 19 entries, none of them decay), so an optimizer run does not change `FACTOR`/`DECAY` in this version. They only vary from FSRS-6 onward.

Seeded cards at retention 0.8, `now = 2026-10-08`:

```
cold      due 2026-10-22  stability 5.8381  scheduledDays 14  reps 1  state REVIEW
hint      due 2026-10-18  stability 4.1701  scheduledDays 10  reps 1  state REVIEW
solution  due 2026-10-15  stability 2.9191  scheduledDays 7   reps 1  state REVIEW
flagged   due 2026-10-12  stability 1.668   scheduledDays 4   reps 1  state REVIEW
```

`scheduledDays` comes from `f.next_interval(stability, 0)`, so FSRS itself reproduces the interval. A Good review of the cold card on its due date gave 83 days (stability 34.53, reps 2). An Again review gave 5 days (FSRS's own result; `applyMinInterval` only lifts anything under 2 days: `lib/scheduler.ts:360-366`, tested at `tests/unit/scheduler-first-intervals.test.ts:65,83`). No 3-day floor remains.

```
$ grep -n "prisma" lib/scheduler.ts
(no output, exit 1)
```

## 3. Lane routing

`lib/scheduler.ts:167`:

```ts
export function deriveLane(item: { reviewed?: boolean; revisit?: boolean; lapses?: number; failedRecall?: boolean }): ReviewLane {
  if (item.revisit) return "RESOLVE";
  if (!item.reviewed) return "RECALL";
  if ((item.lapses ?? 0) >= 2) return "RESOLVE";
  if (item.failedRecall) return "RESOLVE";
  return "RECALL";
}
```

```
$ grep -rn "stability" lib/dashboard.ts lib/scheduler.ts | grep -v test
lib/dashboard.ts:44:        stability: true,            (selected, never read)
lib/dashboard.ts:80:        reviewCard: { select: { due: true, lapses: true, reps: true, stability: true } },
lib/scheduler.ts:150:  stability?: number;              (QueueItem field)
lib/scheduler.ts:355:  const scheduledDays = f.next_interval(stability, 0);
```

No stability clause in lane routing. Live due-card split, all users, at run time: 118 due, **117 Recall / 1 Resolve**. By account: owner `sketchologistabhay` 13/0 (Recall/Resolve), `heyabhaysingh21` 22/1, `adhishshukla12` 34/0, `jsamuelp181` 18/0, `b99captainjakeperalta` 21/0, `kushu123456789` 6/0, `pushtisonawala786` 2/0, `e2e-tester` 1/0. The split is unchanged after the section 8 backfill (117/1 again).

Unchanged: caps (`lib/dashboard.ts:99-100,180`), sort by due then lapses desc (`interleaveLane`, `lib/scheduler.ts:435-441`), pattern-family interleaving (`:447-470`), Resolve before Recall (`interleaveQueue` returns `[...resolve, ...recall]`, `:477`), overdue promotion (`promoteOverdueToRecall(…, 3)`, `lib/dashboard.ts:170`). The full integration suite passes.

## 4. Revisit flag

- 4-day first interval on log: `flagged: data.revisit` in `seedCard` at `app/actions/entry-actions.ts:289` (new entry) and `:185` (first card on an existing entry). Test: `tests/integration/scheduler-lanes.test.ts` "clears the revisit flag…" asserts `scheduledDays === 4`; `tests/unit/scheduler-first-intervals.test.ts:155` "uses the flag before the rating".
- Forces Resolve: `if (item.revisit) return "RESOLVE"` (`lib/scheduler.ts:168`). Tests: `scheduler-first-intervals.test.ts:106`, plus new `scheduler-lanes.test.ts` "routes a freshly flagged card to resolve when it comes due".
- Pulls an existing due date in, never out: `updateEntryInline` (`entry-actions.ts:622`, `if (card && card.due > sooner)`) and the re-log path (`:190`, `if (updatedCardData.due > sooner)`). **Differed:** no test covered either. Added `scheduler-lanes.test.ts` "flagging an existing card pulls its due date in…", "flagging never pushes a sooner due date out", and "re-logging an existing card with the flag pulls its due date in".
- Clears on the next cold solve: `...(data.status === "SOLVED_UNAIDED" ? { revisit: false } : {})` (`entry-actions.ts:469`, and the else branch just below). Test: `scheduler-lanes.test.ts` "clears the revisit flag on the next cold solve".

## 5. Importer

`app/actions/import-actions.ts:644` creates entries with `revisit: false`; the sheet's value still goes into `entriesToSeed` (`revisit: row.parsedRevisit`) and orders the spread in `spreadImportDueDates`. **Differed:** the existing-entry update path had `revisit: false` in the uncommitted working tree; I committed its removal so re-importing no longer wipes a live in-app flag.

Test: `tests/integration/user-loops.test.ts` "performs end-to-end CSV import…" uses `Revisit? = Yes` and asserts `revisitEntry.revisit === false` and that this row's card is due before the later row.

Cleanup script: `CAPS.md` records the `clear-imported-revisit.ts` run (181 imported flags → 0). **This machine has one database connection**: `.env` points at the single Neon endpoint `ep-aged-dawn-aywp6hyy-pooler…`. There is no separate production URL in the repo, so I cannot say a second database exists, nor run or check one. Current count on that database:

```
imported & revisit: 0   non-imported revisit: 0   imported total: 642
```

## 6. Caps

`prisma/schema.prisma` (`UserSettings`): `dailyResolveCap Int @default(2)`, `dailyRecallCap Int @default(8)`.
Migration `20261008120000_daily_recall_cap`: adds the column, then `UPDATE "UserSettings" SET "dailyResolveCap" = 2, "dailyRecallCap" = 8;` (overwrites any value a user had set for the resolve cap).

```
[ { dailyResolveCap: 2, dailyRecallCap: 8, n: 16 } ]      (all UserSettings rows)
20261008120000_daily_recall_cap  done: true
```

`lib/dashboard.ts:99-100`:

```ts
const resolveLeft = Math.max(0, (settings?.dailyResolveCap ?? 2) - resolveDone);
const recallLeft = Math.max(0, (settings?.dailyRecallCap ?? DEFAULT_RECALL_CAP) - recallDone);
```

The `/today` header does not read caps itself. `components/today-client.tsx:201,262` renders `recallCount`/`resolveCount` from `getDailyReviewQueue`, which are the capped queue lengths computed at the lines above. There is no hardcoded 3 left (`grep -rnE "RECALL_CAP|recallCap|ResolveCap"` shows only settings, auth defaults and dashboard).

## 7. Stats

Computed in `lib/stats-engine.ts:162` (`neverSolvedWithoutHelp`) and `:167` (`learnedFromSolutionNeverResolved`); rendered in `components/stats-client.tsx:373,378` as two `SpecCell`s under the headline. Owner (`sketchologistabhay@gmail.com`), before the section 8 backfill:

```
neverSolvedWithoutHelp 133, learnedFromSolutionNeverResolved 9, totalEntries 148
```

## 8. Imported attempt history

- `AttemptSource { IMPORT LOG REVIEW }`, `Attempt.source @default(LOG)`, migration `20261008130000_attempt_source` (backfills `lane IS NOT NULL` → `REVIEW`). Applied to the app schema; `test_hash_it` synced with `db push` over the direct host.

```
source REVIEW lane_null=false  38
source LOG    lane_null=true   36
```
- Source is set at every `attempt.create` (`entry-actions.ts`: LOG for log and re-log, REVIEW for queue resolve and recall; importer: IMPORT). Rating comes from the new shared `importedRating(status)` (`lib/scheduler.ts:510`), which `spreadImportDueDates` also uses. The importer writes `minutes: null`, `at: firstSolvedAt`, `lane: null`, `source: IMPORT`, once per created entry, and once per updated entry only if it has no attempts.
- `scripts/backfill-import-attempts.ts` (dry run default, `--confirm` writes). Scope: `importBatchId` set and no attempts. Run:

```
Attempts by source before: REVIEW 38, LOG 36
Entries with no attempt (all): 613
Imported entries with no attempt (would get one): 612
Attempts written: 612
Attempts by source after: REVIEW 38, IMPORT 612, LOG 36
Imported entries with no attempt after: 0
```

The one remaining entry without an attempt (613 − 612) is the not-imported `e2e-tester` entry.
- `hasQueueReview` still tests `lane != null` (`lib/scheduler.ts:189`). Tests: unit "does not treat an IMPORT attempt (no lane) as a queue review"; integration "routes an entry whose only attempt is IMPORT to Recall, not Resolve"; unit and integration for a recall failed today after an old IMPORT Good, which stays Resolve. The live split stayed 117/1.
- Stat sources: cold-solve rate reads `REVIEW` only (`stats-engine.ts` and `getHeadlineStats` in `lib/dashboard.ts`). **Differed:** it previously counted every attempt, including LOG, so the owner's displayed value changes from 20 of 47 = 42.6% to 13 of 22 = 59.1%. `REVIEW` includes Recall-lane attempts, so a recall pass counts as a cold solve here, per your definition (lane set). "Never solved without help" reads every source. Median time reads `Entry.minutes > 0` (`stats-engine.ts:205`), so null-minute imports drop out (covered by the new stats test).
- Other readers of attempts that would have been distorted by 612 attempts dated at import time: the streak and activity map, "reviews done this week" and weekly-plan "done", monthly-mock struggle score, and the FSRS optimizer's attempt count. Each now excludes `IMPORT`. Streak unchanged at 11 after the backfill.

Owner's stats:

```
                                 before backfill   after backfill
neverSolvedWithoutHelp           133               85
learnedFromSolutionNeverResolved 9                 9
coldSolveRate (REVIEW only)      13/22 = 59.1%     13/22 = 59.1%
```

## 9. Test run

`npx tsc --noEmit`:

```
tsc exit: 0
```

`npx vitest run`:

```

 RUN  v3.2.7 /Users/abhaysingh/Code/hash-it

stdout | tests/integration/auth-matrix.test.ts > Authorization Matrix (Integration) > prevents User A from modifying User B's entry data (cross-user isolation)
prisma:error 
Invalid `prisma.entry.findFirstOrThrow()` invocation in
/Users/abhaysingh/Code/hash-it/app/actions/entry-actions.ts:693:36

  690 export async function toggleScheduleReview(entryId: string, schedule: boolean) {
  691   const user = await getCurrentUser();
  692   const id = z.string().max(64).parse(entryId);
→ 693   const entry = await prisma.entry.findFirstOrThrow(
An operation failed because it depends on one or more records that were required but not found. No record was found for a query.

 ✓ |integration| tests/integration/monthly-review-route.test.ts (2 tests) 10073ms
   ✓ GET /api/review/monthly > only draws problems from patterns the user has logged  7960ms
   ✓ GET /api/review/monthly > returns nothing for a user who hasn't logged anything  2110ms
 ✓ |integration| tests/integration/api-routes.test.ts (3 tests) 10198ms
   ✓ API Routes (Integration) > enforces authentication on all user-scoped API endpoints  2309ms
   ✓ API Routes (Integration) > returns user-scoped dashboard and review data when authenticated  7886ms
stdout | tests/integration/auth-matrix.test.ts > Authorization Matrix (Integration) > prevents User A from modifying User B's entry data (cross-user isolation)
prisma:error 
Invalid `prisma.entry.findFirstOrThrow()` invocation in
/Users/abhaysingh/Code/hash-it/app/actions/entry-actions.ts:365:36

  362 const user = await getCurrentUser();
  363 const data = RecordReviewSchema.parse(input);
  364 
→ 365 const entry = await prisma.entry.findFirstOrThrow(
An operation failed because it depends on one or more records that were required but not found. No record was found for a query.

stdout | tests/integration/auth-matrix.test.ts > Authorization Matrix (Integration) > prevents User A from modifying User B's entry data (cross-user isolation)
prisma:error 
Invalid `prisma.entry.findFirstOrThrow()` invocation in
/Users/abhaysingh/Code/hash-it/app/actions/entry-actions.ts:499:36

  496 const user = await getCurrentUser();
  497 const data = RecordRecallSchema.parse(input);
  498 
→ 499 const entry = await prisma.entry.findFirstOrThrow(
An operation failed because it depends on one or more records that were required but not found. No record was found for a query.

 ✓ |integration| tests/integration/test-isolation.test.ts (2 tests) 3505ms
   ✓ test database isolation > rolls back rows created inside runInTestTransaction  3502ms
 ✓ |unit| tests/unit/auth-get-current-user.test.ts (7 tests) 27ms
 ✓ |unit| tests/unit/middleware.test.ts (8 tests) 27ms
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


 ✓ |unit| tests/unit/scheduler-intervals.test.ts (26 tests) 20ms
 ✓ |unit| tests/unit/weekly-review.test.ts (21 tests) 15ms
 ✓ |unit| tests/unit/greeting-and-week-label.test.ts (6 tests) 12ms
 ✓ |unit| tests/unit/scheduler.test.ts (60 tests) 10ms
 ✓ |unit| tests/unit/custom-fields.test.ts (15 tests) 11ms
 ✓ |unit| tests/unit/formatters-and-helpers.test.ts (37 tests) 7ms
 ✓ |integration| tests/integration/monthly-mock.test.ts (4 tests) 16162ms
   ✓ Monthly mock (Integration) > credits the first mock to this month and locks until next month's last day  6646ms
   ✓ Monthly mock (Integration) > records a session once, even if completion is sent again  2649ms
   ✓ Monthly mock (Integration) > won't let one user replay another user's session id  2376ms
   ✓ Monthly mock (Integration) > saves wrap-up notes only on the caller's own entries, leaving untouched fields alone  4489ms
 ✓ |unit| tests/unit/import-csv.test.ts (21 tests) 7ms
 ✓ |unit| tests/unit/scheduler-basics.test.ts (17 tests) 5ms
 ✓ |unit| tests/unit/csv-matching.test.ts (17 tests) 5ms
 ✓ |unit| tests/unit/env-auth.test.ts (1 test) 5ms
 ✓ |integration| tests/integration/auth-local.test.ts (1 test) 6262ms
   ✓ local auth identity > creates distinct local users for different emails  6260ms
 ✓ |unit| tests/unit/scheduler-first-intervals.test.ts (22 tests) 6ms
 ✓ |unit| tests/unit/monthly-mock-set.test.ts (8 tests) 5ms
 ✓ |unit| tests/unit/auth-config.test.ts (6 tests) 3ms
stdout | tests/unit/practice-grid.test.ts > packPatternGrid > fills every 5-column row with no gaps
Basics | Two Pointer | Fast and Slow Pointer | Sliding Window | Merge Intervals
Prefix Sum | Kadane's Pattern | In-place Reversal of LinkedList | Dummy Node | Stack
HashMap | Heap | Binary Search | Backtracking ×2
BFS ×2 | DFS ×2 | Topological Sort
Dynamic Programming ×2 | Greedy | Trie | Union Find
Bit Manipulation | Matrix Traversal ×2 | Monotonic Stack ×2

 ✓ |unit| tests/unit/practice-grid.test.ts (2 tests) 4ms
 ✓ |unit| tests/unit/pattern-match.test.ts (7 tests) 3ms
 ✓ |unit| tests/unit/pattern-classifier.test.ts (6 tests) 8ms
 ✓ |unit| tests/unit/auth.test.ts (5 tests) 3ms
 ✓ |integration| tests/integration/import-attempts.test.ts (3 tests) 16362ms
   ✓ imported attempt history > routes an entry whose only attempt is IMPORT to Recall, not Resolve  7601ms
   ✓ imported attempt history > still sends a recall failed today to Resolve when an older IMPORT Good exists  3363ms
   ✓ imported attempt history > counts imports toward never-solved-without-help but not the cold-solve rate or median time  5394ms
 ✓ |unit| tests/unit/roadmap-access.test.ts (2 tests) 2ms
 ✓ |unit| tests/unit/stats.test.ts (7 tests) 4ms
 ✓ |component| tests/component/problem-grid.test.tsx (6 tests) 310ms
 ✓ |component| tests/component/import-wizard.test.tsx (7 tests) 465ms
 ✓ |component| tests/component/monthly-mock.test.tsx (4 tests) 998ms
   ✓ MonthlyMockProvider and NavControls > times each problem on its own, not from the start of the session  343ms
 ✓ |component| tests/component/log-extra-fields.test.tsx (6 tests) 249ms
 ✓ |component| tests/component/simple-components.test.tsx (8 tests) 166ms
 ✓ |component| tests/component/command-bar.test.tsx (8 tests) 1631ms
   ✓ CommandBar > searches and displays results  386ms
   ✓ CommandBar > allows selecting a problem and logging it  405ms
   ✓ CommandBar > suggests existing patterns while typing a pattern tag and selects one on click  403ms
   ✓ CommandBar > handles manual entry form if no results found  395ms
 ✓ |component| tests/component/settings-form.test.tsx (3 tests) 153ms
 ✓ |component| tests/component/layout-components.test.tsx (8 tests) 153ms
 ✓ |component| tests/component/card-components.test.tsx (5 tests) 126ms
 ✓ |component| tests/component/weekly-plan-items.test.tsx (3 tests) 107ms
 ✓ |component| tests/component/faq-list.test.tsx (3 tests) 101ms
 ✓ |component| tests/component/ui-components.test.tsx (7 tests) 88ms
 ✓ |component| tests/component/keyboard-shortcuts-modal.test.tsx (5 tests) 65ms
 ✓ |integration| tests/integration/custom-fields.test.ts (3 tests) 21680ms
   ✓ Custom fields (Integration) > imports a user's own sheet: maps headers, creates typed fields, stores values  12860ms
   ✓ Custom fields (Integration) > dry-run without a name or link column is rejected  771ms
   ✓ Custom fields (Integration) > log + edit: values are validated against the user's defs and other users' ids are ignored  8046ms
 ✓ |integration| tests/integration/scheduler-lanes.test.ts (6 tests) 37070ms
   ✓ first review then a failed recall > logs into a recall check, and a failed recall comes back as resolve  12993ms
   ✓ first review then a failed recall > clears the revisit flag on the next cold solve  5685ms
   ✓ first review then a failed recall > routes a freshly flagged card to resolve when it comes due  4198ms
   ✓ first review then a failed recall > flagging an existing card pulls its due date in to the flagged interval  5649ms
   ✓ first review then a failed recall > flagging never pushes a sooner due date out  3887ms
   ✓ first review then a failed recall > re-logging an existing card with the flag pulls its due date in  4655ms
 ✓ |integration| tests/integration/user-loops.test.ts (7 tests) 43477ms
   ✓ User Loops (Integration) > completes full log problem loop with initial card scheduling and attempt creation  6976ms
   ✓ User Loops (Integration) > handles review outcome pass and fail transitions  9012ms
   ✓ User Loops (Integration) > logs a fast first solve as GOOD, not EASY  3092ms
   ✓ User Loops (Integration) > records quick recall rating and updates card  5048ms
   ✓ User Loops (Integration) > returns a blank promoted recall to the full-solve lane tomorrow  4346ms
   ✓ User Loops (Integration) > performs end-to-end CSV import with matching, duplicates resolution, and schedule spread  10520ms
   ✓ User Loops (Integration) > updates user settings and retention parameters correctly  4479ms
 ✓ |integration| tests/integration/auth-matrix.test.ts (8 tests) 50224ms
   ✓ Authorization Matrix (Integration) > rejects unauthorized access when no session is present  2309ms
   ✓ Authorization Matrix (Integration) > rejects unauthenticated requests to every user-scoped API handler  507ms
   ✓ Authorization Matrix (Integration) > prevents User A from modifying User B's entry data (cross-user isolation)  11134ms
   ✓ Authorization Matrix (Integration) > keeps settings and import batches isolated between users  6919ms
   ✓ Authorization Matrix (Integration) > API handlers only return the authenticated user's data  11679ms
   ✓ Authorization Matrix (Integration) > id-addressed problem detail returns not-found for another user's entry  2024ms
   ✓ Authorization Matrix (Integration) > sign-in by a new user inherits no existing records  5774ms
   ✓ Authorization Matrix (Integration) > allows User A to modify own data successfully  9873ms
 ✓ |integration| tests/integration/weekly-review.test.ts (5 tests) 58051ms
   ✓ Weekly review (Integration) > keeps the daily quick-recall total at eight as passed cards leave the queue  20197ms
   ✓ Weekly review (Integration) > picks weak problems, keeps weekly misses out of the FSRS schedule, and shows a next-day recall  17633ms
   ✓ Weekly review (Integration) > commits a plan and marks items done once attempted  13823ms
   ✓ Weekly review (Integration) > rejects a REDO pick the user never logged  2443ms
   ✓ Weekly review (Integration) > is read-only between Tuesday and Saturday  3952ms

 Test Files  45 passed (45)
      Tests  418 passed (418)
   Start at  08:43:33
   Duration  58.78s (transform 869ms, setup 2.04s, collect 8.78s, tests 277.86s, environment 4.18s, prepare 1.91s)

```
