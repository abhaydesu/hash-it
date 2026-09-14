# Fixes 3

## 1. Review queue logging

Command:
```
cd /Users/abhaysingh/Code/hash-it && npx tsx -e 'import { PrismaClient } from "@prisma/client"; const p = new PrismaClient(); (async()=>{const r = await p.$queryRawUnsafe("select count(*) from \"ProblemPattern\""); console.log(r); await p.$disconnect();})()'
```

Output:
```
[ { count: 66n } ]
```

## 2. Pattern seed script run

Command:
```
cd /Users/abhaysingh/Code/hash-it && npx tsx scripts/seed-patterns.ts
```

Output:
```
==> Seeding pattern mappings from roadmap CSV...
[OK] Seeded 25 canonical patterns.
```

## 3. Live database totals after the seed

Command:
```
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
```
{
  "patternCount": 36,
  "problemPatternCount": 207,
  "problemCount": 4073
}
```
