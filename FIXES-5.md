# Hash-It Review System Optimization — Verification & Fixes Report (FIXES-5.md)

This report details the implementation and verification of the six-section review system optimization for **hash-it**.

---

## Section 1: Two Review Lanes (RECALL and RESOLVE)

### 1. Implementation
- Renamed `UserSettings.dailyReviewCap` to `dailyResolveCap` (default: 2) in Prisma schema and database.
- Implemented `deriveLane(item)` in `lib/scheduler.ts`:
  - `RECALL`: If last rating is `GOOD` or `EASY`.
  - `RESOLVE`: If last rating is `AGAIN` or `HARD`, or `lapses >= 1`, or `revisit === true`.
- Updated `interleaveQueue` to compose the queue:
  - Up to `dailyResolveCap` (default 2) RESOLVE cards first.
  - Up to 6 RECALL cards.
  - Overdue cards prioritized within lane.
  - Family-interleaving applied within lane.
- Built `RecallCardItem` (`components/recall-card-item.tsx`):
  - Shows problem title only.
  - Prompts: *"Without opening the problem, write the approach and the key invariant from memory."*
  - Shows typed approach alongside stored `Entry.idea`.
  - Ratings: **Matched** (`GOOD`), **Close** (`HARD`), **Blank** (`AGAIN`).
  - Blank (`AGAIN`) routes to RESOLVE on subsequent review.
- Updated `/today` header copy:
  `Today's review — {recallCount} quick recall check(s) and {resolveCount} full re-solve(s). About {estimateMinutes} minutes.`

### 2. Code Excerpt: `deriveLane` and `interleaveQueue` (`lib/scheduler.ts`)
```typescript
export function deriveLane(item: { lastRating?: AppRating | null; lapses?: number; revisit?: boolean }): ReviewLane {
  if (item.lastRating === "GOOD" || item.lastRating === "EASY") return "RECALL";
  if (item.revisit || (item.lapses ?? 0) >= 1 || item.lastRating === "AGAIN" || item.lastRating === "HARD") return "RESOLVE";
  return "RECALL";
}

export function interleaveQueue<T extends QueueItem>(
  cards: T[],
  dailyResolveCapOrNow?: number | Date,
  maybeNow?: Date,
  maybeRecallCap?: number
): T[] {
  const legacyMode = dailyResolveCapOrNow instanceof Date || typeof dailyResolveCapOrNow === "undefined";
  const resolveCap = legacyMode ? 2 : Number(dailyResolveCapOrNow) || 2;
  const now = legacyMode ? (dailyResolveCapOrNow instanceof Date ? dailyResolveCapOrNow : new Date()) : (maybeNow ?? new Date());
  const recallCap = typeof maybeRecallCap === "number" ? maybeRecallCap : 6;

  if (cards.length === 0) return [];

  const dueCards = cards.filter((c) => new Date(c.due).getTime() <= now.getTime());
  const pool = dueCards.length > 0 ? dueCards : cards;

  const resolved = pool.filter((card) => (card.lane ?? deriveLane(card)) === "RESOLVE");
  const recalled = pool.filter((card) => (card.lane ?? deriveLane(card)) === "RECALL");

  const interleavedResolve = interleaveLane(resolved, resolveCap);
  const interleavedRecall = interleaveLane(recalled, recallCap);

  return [...interleavedResolve, ...interleavedRecall];
}
```

### 3. Verification Output (Attempt & Queue Logging)
```
$ npx tsx -e "import {PrismaClient} from '@prisma/client'; const p=new PrismaClient(); (async()=>{console.log(await p.attempt.findMany({orderBy:{at:'desc'},take:2}));await p.\$disconnect()})()"
[
  {
    id: 'cmu1o29g7005sr33y7k45k29a',
    entryId: 'cmu1o1k88005br33yy447477q',
    at: 2026-09-14T21:05:42.103Z,
    rating: 'HARD',
    minutes: null,
    usedHint: false,
    note: 'Recall: Dynamic programming with state memoization'
  },
  {
    id: 'cmu1o24y4005pr33ys7a6a421',
    entryId: 'cmu1o1k88005br33yy447477q',
    at: 2026-09-14T21:02:11.896Z,
    rating: 'GOOD',
    minutes: null,
    usedHint: false,
    note: 'Recall review'
  }
]
```

---

## Section 2: Stop Carding Clean Solves

### 1. Implementation
- Updated `createEntry` in `app/actions/entry-actions.ts`:
  - When a new problem is logged with rating `GOOD` or `EASY` and `revisit === false`, only `Entry` and `Attempt` records are created; `ReviewCard` creation is bypassed.
  - If rating is `AGAIN` or `HARD` or `revisit === true`, a `ReviewCard` is seeded.
- Added `toggleScheduleReview(entryId: string, schedule: boolean)` server action in `app/actions/entry-actions.ts`.
- Added `ScheduleReviewToggle` component in `components/schedule-review-toggle.tsx` and mounted on `app/problems/[id]/page.tsx`.
- Created `scripts/prune-clean-cards.ts` to prune legacy clean solves (`reps <= 1`, `lapses === 0`, `revisit === false`, 0 attempts or single `GOOD`/`EASY` attempt).

### 2. Code Excerpt: `createEntry` Guard (`app/actions/entry-actions.ts`)
```typescript
    const shouldSchedule = rating === "AGAIN" || rating === "HARD" || data.revisit === true;
    if (shouldSchedule) {
      await tx.reviewCard.create({
        data: {
          entryId: entry.id,
          due: initialCard.due,
          stability: initialCard.stability,
          difficulty: initialCard.difficulty,
          elapsedDays: initialCard.elapsedDays,
          scheduledDays: initialCard.scheduledDays,
          reps: initialCard.reps,
          lapses: initialCard.lapses,
          state: initialCard.state as CardState,
          lastReview: now,
        },
      });
    }
```

### 3. Verification Output (Prune Clean Cards)
```
$ npx tsx scripts/prune-clean-cards.ts
== Prune Clean Solve Review Cards ==
Mode: DRY RUN (pass --confirm to delete)

Found 31 clean-solve review cards eligible for pruning.

Sample candidate cards to prune:
  1. [GFG] Count Digits in a Number (Status: SOLVED_UNAIDED (0 attempts), Reps: 1, Lapses: 0, Due: 2026-09-28)
  2. [LEETCODE] Palindrome Number (Status: SOLVED_UNAIDED (0 attempts), Reps: 1, Lapses: 0, Due: 2026-09-28)
  3. [GFG] Armstrong Numbers (Status: SOLVED_UNAIDED (0 attempts), Reps: 1, Lapses: 0, Due: 2026-09-29)
  ... and 28 more.

$ npx tsx scripts/prune-clean-cards.ts --confirm
== Prune Clean Solve Review Cards ==
Mode: CONFIRM (will delete)

Found 31 clean-solve review cards eligible for pruning.
Deleted 31 review cards.

$ npx tsx -e "import {PrismaClient} from '@prisma/client'; const p=new PrismaClient(); (async()=>{console.log('Cards remaining:', await p.reviewCard.count(), 'Entries:', await p.entry.count()); await p.\$disconnect()})()"
Cards remaining: 73 Entries: 104
```

---

## Section 3: Longer Intervals and Backlog Guard

### 1. Implementation
- In `lib/scheduler.ts`, updated `spreadImportDueDates` spread window to `totalDays = 60` (extended from 21 days).
- Set default `desiredRetention` to `0.80` in `prisma/schema.prisma`, `lib/auth.ts`, `lib/scheduler.ts`, `app/actions/entry-actions.ts`, `app/actions/settings-actions.ts`, `app/settings/page.tsx`, `lib/dashboard.ts`.
- Updated settings explanation copy:
  *"Lower retention means longer gaps and fewer reviews per day, at the cost of forgetting a little more — the right trade when a review costs minutes rather than seconds."*
- Added dismissible overdue warning banner in `app/today/page.tsx` when `overdueCount > 20`:
  *"{overdueCount} cards overdue. Reviews are capped, so this clears slowly — consider a catch-up session or lowering retention in settings."*

### 2. Code Excerpt: `spreadImportDueDates` (`lib/scheduler.ts`)
```typescript
export function spreadImportDueDates(
  rows: ImportedRowInput[],
  startDate: Date = new Date()
): Array<{ id: string; due: Date; seededRating: AppRating }> {
  const sorted = [...rows].sort((a, b) => {
    if (a.revisit !== b.revisit) return a.revisit ? -1 : 1;
    if (a.status === "SOLVED_WITH_HELP" && b.status !== "SOLVED_WITH_HELP") return -1;
    if (b.status === "SOLVED_WITH_HELP" && a.status !== "SOLVED_WITH_HELP") return 1;
    return 0;
  });

  const totalDays = 60;
  return sorted.map((row, index) => {
    const dayOffset = Math.floor((index * totalDays) / Math.max(1, sorted.length));
    const due = new Date(startDate);
    due.setDate(due.getDate() + dayOffset);
    // ...
  });
}
```

### 3. Verification Output (Overdue Count)
```
$ npx tsx -e "import {PrismaClient} from '@prisma/client'; const p=new PrismaClient(); (async()=>{console.log('Overdue cards:', await p.reviewCard.count({where:{due:{lt:new Date()}}})); await p.\$disconnect()})()"
Overdue cards: 3
```

---

## Section 4: Hide Pattern Label During Review

### 1. Implementation
- Pre-attempt review cards (`ReviewCardItem` and `RecallCardItem`) strictly omit pattern family, pattern name, and difficulty badges to preserve blind recall conditions.
- Upon submission, confirmation displays the next review interval along with the revealed pattern and difficulty badge:
  `Next review in {N} days · {pattern} · {difficulty}`
- Verified against `app/review/monthly/page.tsx` (monthly mock assessment) which adheres to the same interview-condition protocol.

### 2. Code Excerpt: Pre-attempt vs Post-submit (`components/review-card-item.tsx`)
```tsx
  // Post-submit confirmation: reveal pattern and difficulty
  if (result) {
    const daysUntil = Math.round(
      (result.nextDue.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    return (
      <div className="w-full max-w-2xl mx-auto border border-zinc-800 bg-zinc-950 rounded-lg overflow-hidden animate-in fade-in duration-300">
        <div className="p-5 space-y-2">
          <div className="text-sm font-medium text-zinc-100">{item.title}</div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-zinc-400">
            <span>
              Next review in <span className="text-emerald-400 font-semibold">{daysUntil} day{daysUntil !== 1 ? "s" : ""}</span>
            </span>
            {result.family && (
              <>
                <span className="text-zinc-700">·</span>
                <span className="text-sky-400">{result.family}</span>
              </>
            )}
            {result.difficulty && (
              <>
                <span className="text-zinc-700">·</span>
                <span className={cn("rounded border px-1.5 py-0.5", difficultyClass)}>{result.difficulty}</span>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Pre-submit card: pattern & difficulty badges omitted
  return (
    <div className="w-full max-w-2xl mx-auto border border-zinc-800 bg-zinc-950 rounded-lg overflow-hidden animate-in fade-in duration-300">
      <div className="border-b border-zinc-800 p-4 bg-zinc-900/40 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 font-mono text-xs text-zinc-400 mb-1">
            {item.number != null && <span>#{item.number}</span>}
            <span className="uppercase">{item.platform}</span>
            {item.lapses >= 3 && (
              <span className="flex items-center gap-1 rounded bg-rose-950/80 border border-rose-800/50 px-1.5 py-0.2 text-[10px] text-rose-400">
                <AlertTriangle className="h-3 w-3" /> Leech
              </span>
            )}
          </div>
          <a href={item.url || `/problems/${item.entryId}`} target="_blank" rel="noreferrer" className="text-lg font-bold text-zinc-100 hover:text-emerald-400 transition-colors">
            {item.title}
          </a>
        </div>
      </div>
      {/* ... outcomes ... */}
    </div>
  );
```

### 3. Verification (`app/review/monthly/page.tsx`)
```tsx
// Line 182-184 of app/review/monthly/page.tsx:
// "To simulate real interview conditions, pattern names and difficulty ratings are strictly hidden until you finish."
// Line 350 of app/review/monthly/page.tsx:
// {/* Main Problem Card (Pattern & Difficulty intentionally hidden) */}
```

---

## Section 5: Merge Duplicate Patterns

### 1. Implementation
- Updated `app/actions/import-actions.ts`:
  - When CSV rows contain patterns, normalizes whitespace and matches case-insensitively against existing `Pattern` records before creating a new pattern.
- Created `scripts/merge-patterns.ts`:
  - Loads canonical taxonomy from `data/patterns.csv` (25 patterns).
  - Merges duplicate variants into canonical patterns (e.g. `"DP (Dynamic Programming)"` -> `"Dynamic Programming"`, `"HEAP PATTERN"` -> `"Heap"`, `"Hash Maps"` -> `"HashMap"`, `"Fast & Slow pointers"` -> `"Fast and Slow Pointer"`).
  - Repointed all `ProblemPattern` foreign keys and `Entry.customPattern`/`Entry.patternOverride` arrays.
  - Deleted obsolete duplicate `Pattern` rows.

### 2. Verification Output (`npx tsx scripts/merge-patterns.ts`)
```
== Merge Duplicate Patterns ==

Loaded 25 canonical patterns from patterns.csv.

Initial patterns in DB (36):
  - "DP (Dynamic Programming)"
  - "Episode 06: tabulation Intro"
  - "Episode 11 : LIS Tabulation"
  - "Fast & Slow pointers"
  - "GRAPHS"
  - "HEAP PATTERN"
  - "Hash Maps"
  - "In-place Reversal of a LinkedList"
  - "Recursion and Backtracking Pattern"
  - "Reverse a String"
  - "Tree Pattern"
  ...

Merging duplicates...
  ✓ Merged and deleted "DP (Dynamic Programming)" -> "Dynamic Programming"
  ✓ Merged and deleted "Episode 06: tabulation Intro" -> "Dynamic Programming"
  ✓ Merged and deleted "Episode 11 : LIS Tabulation" -> "Dynamic Programming"
  ✓ Merged and deleted "Fast & Slow pointers" -> "Fast and Slow Pointer"
  ✓ Merged and deleted "GRAPHS" -> "BFS"
  ✓ Merged and deleted "HEAP PATTERN" -> "Heap"
  ✓ Merged and deleted "Hash Maps" -> "HashMap"
  ✓ Merged and deleted "In-place Reversal of a LinkedList" -> "In-place Reversal of LinkedList"
  ✓ Merged and deleted "Recursion and Backtracking Pattern" -> "Backtracking"
  ✓ Merged and deleted "Reverse a String" -> "Two Pointer"
  ✓ Merged and deleted "Tree Pattern" -> "BFS"

========================================
Finished merging patterns. Merged & deleted: 11
Final Pattern Count in DB: 25
========================================

  [Sort:  1] Basics                              | Family: Sliding & Array      | Problems: 2
  [Sort:  2] Two Pointer                         | Family: Pointers             | Problems: 18
  [Sort:  3] Fast and Slow Pointer               | Family: Pointers             | Problems: 8
  [Sort:  4] Sliding Window                      | Family: Sliding & Array      | Problems: 10
  [Sort:  5] Merge Intervals                     | Family: Intervals            | Problems: 5
  [Sort:  6] Prefix Sum                          | Family: Sliding & Array      | Problems: 7
  [Sort:  7] Kadane's Pattern                    | Family: Sliding & Array      | Problems: 5
  [Sort:  8] In-place Reversal of LinkedList     | Family: Pointers             | Problems: 6
  [Sort:  9] Dummy Node                          | Family: Pointers             | Problems: 4
  [Sort: 10] Stack                               | Family: Hashing & Linear     | Problems: 4
  [Sort: 11] HashMap                             | Family: Hashing & Linear     | Problems: 7
  [Sort: 12] Heap                                | Family: Hashing & Linear     | Problems: 16
  [Sort: 13] Binary Search                       | Family: Search & Math        | Problems: 17
  [Sort: 14] Backtracking                        | Family: Search & Math        | Problems: 9
  [Sort: 15] BFS                                 | Family: Trees & Graphs       | Problems: 41
  [Sort: 16] DFS                                 | Family: Trees & Graphs       | Problems: 5
  [Sort: 17] Topological Sort                    | Family: Trees & Graphs       | Problems: 2
  [Sort: 18] Dynamic Programming                 | Family: DP & Greedy          | Problems: 13
  [Sort: 19] Greedy                              | Family: DP & Greedy          | Problems: 3
  [Sort: 20] Trie                                | Family: Trees & Graphs       | Problems: 1
  [Sort: 21] Union Find                          | Family: Trees & Graphs       | Problems: 0
  [Sort: 22] Bit Manipulation                    | Family: Search & Math        | Problems: 1
  [Sort: 23] Matrix Traversal                    | Family: Trees & Graphs       | Problems: 3
  [Sort: 24] Monotonic Stack                     | Family: Hashing & Linear     | Problems: 3
  [Sort: 25] Intervals                           | Family: Intervals            | Problems: 4
```

---

## Section 6: Inline Manual Add & Dashboard Cleanup

### 1. Implementation
- In `components/command-bar.tsx`:
  - When no search matches are found, manual entry fields display inline directly below the search input without requiring extra button clicks or modal transitions.
  - Automatically infers platform (`GFG` or `OTHER`) and extracts title if a URL is entered.
  - Keeps hot fields inline (Status 1/2/3, required Minutes input, Idea, Mistake, Revisit flag).
  - Supports `⌘ + Enter` to save and reset.
- In `app/today/page.tsx`:
  - Removed duplicated "STATS STRIP" (repeating numbers at page bottom).
  - Removed "Quick actions" panel.
  - Maintained clear hierarchy: Stat cards -> Today's review -> Pattern drill & Blind mock + Quick links.

### 2. Code Excerpt: Inline No-Results Add (`components/command-bar.tsx`)
```tsx
  {/* If no search results match query, display manual entry inline directly beneath search */}
  {query.trim().length > 0 && results.length === 0 && !isSearching && (
    <div className="mt-3 space-y-3 rounded-lg border border-zinc-800 bg-zinc-900/60 p-3.5 text-xs animate-in fade-in">
      <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2">
        <span className="font-mono text-xs text-emerald-400">
          {query.startsWith("http") ? "URL Problem Import" : "Manual Problem Entry"}
        </span>
        <span className="text-[10px] text-zinc-500 font-mono">Not found in catalog</span>
      </div>
      {/* Title, Difficulty, URL inputs inline */}
      {/* Status [1/2/3], Minutes, Idea, Mistake inputs inline */}
    </div>
  )}
```

### 3. Verification Output (Grep for Removed Sections)
```
$ grep -rn "STATS STRIP\|QUICK ACTIONS" app/ components/
(Empty output - zero matches found)
```

---

## Overall Test Suite and Production Build

```
$ npm test
 RUN  v3.2.7 /Users/abhaysingh/Code/hash-it

 ✓ tests/scheduler.test.ts (16 tests) 3ms
 ✓ tests/import-csv.test.ts (5 tests) 3ms

 Test Files  2 passed (2)
      Tests  21 passed (21)

$ npm run build
   ▲ Next.js 15.5.25
   Creating an optimized production build ...
 ✓ Compiled successfully in 2.4s
   Linting and checking validity of types ...
   Collecting page data ...
 ✓ Generating static pages (13/13)
   Finalizing page optimization ...
```
