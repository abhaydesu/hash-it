# Fixes 4

This pass records the work that has actually been completed and the verification that supports it.

## 1. Queue safety / missing-minute fix

Status: complete.

What changed:
- The dashboard review flow no longer hard-fails when a solve is logged without a minute value.
- Missing minutes fall back to a HARD rating instead of crashing the action.
- This was the root cause of the runtime failure in the queue path.

Verification command:
```bash
cd /Users/abhaysingh/Code/hash-it && npx vitest run tests/scheduler.test.ts
```

Verification output:
```text
Test Files  1 passed (1)
Tests       15 passed (15)
```

This includes the relevant regression for:
- "derives HARD when a solve is logged without minutes"

## 2. Daily review workload reduction

Status: implemented.

What changed:
- The default daily review cap was reduced to 2.
- Desired retention default was lowered to 0.80.
- The scheduler and settings defaults were updated to reflect the lower-load review model.

Relevant files:
- `lib/auth.ts`
- `app/actions/settings-actions.ts`
- `app/settings/page.tsx`
- `prisma/schema.prisma`
- `lib/scheduler.ts`

## 3. Pattern seed / live data verification

Status: verified.

The seeding work was executed and the live DB totals were checked.

Verification commands:
```bash
cd /Users/abhaysingh/Code/hash-it && node --input-type=module <<'NODE'
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
try {
  const patternCount = await prisma.pattern.count();
  const problemPatternCount = await prisma.problemPattern.count();
  const problemCount = await prisma.problem.count();
  console.log(JSON.stringify({ patternCount, problemPatternCount, problemCount }, null, 2));
} finally {
  await prisma.$disconnect();
}
NODE
```

Output:
```json
{
  "patternCount": 36,
  "problemPatternCount": 207,
  "problemCount": 4073
}
```

This confirms the pattern taxonomy data was actually seeded and not just reported as present.

## 4. Queue ordering fix

Status: verified.

What changed:
- The queue logic now preserves the correct priority ordering: oldest overdue items and highest-lapse items remain prioritized within the cap.
- The regression that allowed a fresh item to outrank an urgent one was fixed.

Verification command:
```bash
cd /Users/abhaysingh/Code/hash-it && npx vitest run tests/scheduler.test.ts
```

Verification output:
```text
✓ scheduler - interleaving constraint > respects dailyReviewCap and prioritizes oldest overdue and highest lapses
```

## 5. Overall status

The fixes in the prior prompt that were actually implemented and verified are in place:
- missing-minute queue crash fixed
- daily-review cap reduction in place
- retention defaults reduced
- queue ordering corrected
- pattern seed verified against live DB counts

The repo is in a materially cleaner and more truthful state than it was before this pass.
