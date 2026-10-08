## 1. Stop imported revisit flags from routing to Resolve

The importer keeps the spreadsheet value for `spreadImportDueDates`, creates imported entries with `revisit: false`, and leaves an existing entry's in-app flag alone (`app/actions/import-actions.ts:605-648`). The import integration test uses `Revisit? = Yes`, asserts the saved flag is false, and checks that row is due before the later row (`tests/integration/user-loops.test.ts:196-232`).

Cleanup scope: `Entry.importBatchId IS NOT NULL`, which links an entry to its `ImportBatch`. The script touches `Entry` only and does not update review cards or due dates (`scripts/clear-imported-revisit.ts`).

Dry run:

```text
Mode: DRY RUN
Imported revisit entries before: 181
Imported revisit entries after: 181
Due lane split before: {"RESOLVE":51,"RECALL":67}
Due lane split after: {"RESOLVE":1,"RECALL":117}
No changes made. Pass --confirm to clear these imported flags.
```

Confirmed run:

```text
Mode: CONFIRM
Imported revisit entries before: 181
Imported revisit entries after: 0
Due lane split before: {"RESOLVE":51,"RECALL":67}
Due lane split after: {"RESOLVE":1,"RECALL":117}
Entries cleared: 181
Verified imported revisit entries after: 0
```

Import integration test from `npx vitest run`:

```text
✓ |integration| tests/integration/user-loops.test.ts (7 tests) 42512ms
  ✓ User Loops (Integration) > performs end-to-end CSV import with matching, duplicates resolution, and schedule spread
```

## 2. Make both daily lane caps configurable

The migration added `dailyRecallCap` with default 8 and updated every existing `UserSettings` row to recall 8 / resolve 2. There were 16 rows before the migration; the post-migration database check returned:

```text
cap rows {"count":16,"values":["8/2"]}
```

Migration output:

```text
Applying migration `20261008120000_daily_recall_cap`
The following migration(s) have been applied:

migrations/
  └─ 20261008120000_daily_recall_cap/
    └─ migration.sql

All migrations have been successfully applied.
```

The `/today` queue reads both caps from the user's settings (`lib/dashboard.ts:99-100`). Its header uses the queue's recall / resolve counts and estimates 3 minutes per recall and 25 per resolve (`components/today-client.tsx:201,258-264`). The settings form exposes both caps and the requested help text (`components/settings-client.tsx:128-151`).

Verification:

```text
Test Files  3 passed (3)
     Tests  80 passed (80)
```

The run covered scheduler unit tests, settings form tests, and the scheduler basics. `npx tsc --noEmit` completed with no diagnostics.

## 3. Measure never re-solved problems

The stats are per-user and use attempt history plus the scheduler's current lane rules (`lib/stats-engine.ts:137-175`). `/stats` shows each count with its definition and no charts (`components/stats-client.tsx:367-381`).

Database result for `sketchologistabhay@gmail.com` (148 entries):

```text
{"user":"sketchologistabhay@gmail.com","totalEntries":148,"neverSolvedWithoutHelp":133,"learnedFromSolutionNeverResolved":9}
```

Full `npx vitest run` output summary:

```text
Test Files  43 passed (43)
     Tests  407 passed (407)
   Duration  57.39s (transform 670ms, setup 1.50s, collect 6.22s, tests 238.67s, environment 3.39s, prepare 1.35s)
```

## Update: recall cap default is now 5

Migration `20261008150000_recall_cap_default_5` sets the column default to 5 and moves rows still at 8 to 5. A value a user set themselves is left alone.
