import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";
import Papa from "papaparse";

const prisma = new PrismaClient();

const CANONICAL_CSV_PATH = path.join(process.cwd(), "data", "patterns.csv");

// Explicit mapping for known variations and import artifacts
const PATTERN_MAP: Record<string, string> = {
  "two pointers": "Two Pointer",
  "two pointer": "Two Pointer",
  "fast & slow pointers": "Fast and Slow Pointer",
  "fast and slow pointer": "Fast and Slow Pointer",
  "fast & slow pointer": "Fast and Slow Pointer",
  "in-place reversal of a linkedlist": "In-place Reversal of LinkedList",
  "in-place reversal of linkedlist": "In-place Reversal of LinkedList",
  "hash maps": "HashMap",
  "hashmap": "HashMap",
  "heap pattern": "Heap",
  "heap": "Heap",
  "recursion and backtracking pattern": "Backtracking",
  "backtracking": "Backtracking",
  "dp (dynamic programming)": "Dynamic Programming",
  "dynamic programming": "Dynamic Programming",
  "episode 06: tabulation intro": "Dynamic Programming",
  "episode 11 : lis tabulation": "Dynamic Programming",
  "tree pattern": "BFS",
  "graphs": "BFS",
  "reverse a string": "Two Pointer",
  "prefix sums": "Prefix Sum",
  "prefix sum": "Prefix Sum",
  "monotonic stacks": "Monotonic Stack",
  "sliding windows": "Sliding Window",
};

async function main() {
  console.log("== Merge Duplicate Patterns ==\n");

  // 1. Read Canonical CSV
  const csvContent = fs.readFileSync(CANONICAL_CSV_PATH, "utf-8");
  const parsed = Papa.parse<{ name: string; family: string; sortOrder: string }>(csvContent, {
    header: true,
    skipEmptyLines: true,
  });

  console.log(`Loaded ${parsed.data.length} canonical patterns from patterns.csv.`);

  // Upsert all canonical patterns first
  const canonicalMap = new Map<string, { id: string; name: string; family: string }>();

  for (const row of parsed.data) {
    if (!row.name) continue;
    const name = row.name.trim();
    const family = row.family?.trim() || "General";
    const sortOrder = parseInt(row.sortOrder, 10) || 999;

    const p = await prisma.pattern.upsert({
      where: { name },
      update: { family, sortOrder },
      create: { name, family, sortOrder },
    });

    canonicalMap.set(name.toLowerCase(), p);
    canonicalMap.set(name, p);
  }

  // 2. Fetch all patterns in DB
  const initialPatterns = await prisma.pattern.findMany({
    orderBy: { name: "asc" },
    include: {
      problems: true,
    },
  });

  console.log(`\nInitial patterns in DB (${initialPatterns.length}):`);
  initialPatterns.forEach((p) => {
    console.log(`  - [${p.id}] "${p.name}" (Family: ${p.family}, Problems linked: ${p.problems.length})`);
  });

  // 3. Identify and merge duplicates
  let mergedCount = 0;

  for (const pat of initialPatterns) {
    const normKey = pat.name.trim().toLowerCase().replace(/\s+/g, " ");
    const canonicalTargetName = PATTERN_MAP[normKey];

    if (canonicalTargetName && canonicalTargetName !== pat.name) {
      const canonicalPat = canonicalMap.get(canonicalTargetName.toLowerCase()) || canonicalMap.get(canonicalTargetName);

      if (canonicalPat && canonicalPat.id !== pat.id) {
        console.log(`\nMerging "${pat.name}" (${pat.id}) -> "${canonicalPat.name}" (${canonicalPat.id})...`);

        // Re-link ProblemPatterns
        for (const pp of pat.problems) {
          const alreadyLinked = await prisma.problemPattern.findUnique({
            where: {
              problemId_patternId: {
                problemId: pp.problemId,
                patternId: canonicalPat.id,
              },
            },
          });

          if (!alreadyLinked) {
            await prisma.problemPattern.update({
              where: {
                problemId_patternId: {
                  problemId: pp.problemId,
                  patternId: pat.id,
                },
              },
              data: {
                patternId: canonicalPat.id,
              },
            });
          } else {
            await prisma.problemPattern.delete({
              where: {
                problemId_patternId: {
                  problemId: pp.problemId,
                  patternId: pat.id,
                },
              },
            });
          }
        }

        // Update Entry.customPattern and Entry.patternOverride
        const matchingEntries = await prisma.entry.findMany({
          where: {
            OR: [
              { customPattern: pat.name },
              { patternOverride: { has: pat.name } },
            ],
          },
        });

        for (const entry of matchingEntries) {
          const newOverrides = entry.patternOverride.map((po) =>
            po === pat.name ? canonicalPat.name : po
          );
          await prisma.entry.update({
            where: { id: entry.id },
            data: {
              customPattern: entry.customPattern === pat.name ? canonicalPat.name : entry.customPattern,
              patternOverride: newOverrides,
            },
          });
        }

        // Delete the duplicate pattern
        await prisma.pattern.delete({
          where: { id: pat.id },
        });

        mergedCount++;
        console.log(`  ✓ Merged and deleted "${pat.name}"`);
      }
    }
  }

  // 4. Print final pattern list
  const finalPatterns = await prisma.pattern.findMany({
    orderBy: { sortOrder: "asc" },
    include: { problems: true },
  });

  console.log(`\n========================================`);
  console.log(`Finished merging patterns. Merged & deleted: ${mergedCount}`);
  console.log(`Final Pattern Count in DB: ${finalPatterns.length}`);
  console.log(`========================================\n`);

  finalPatterns.forEach((p) => {
    console.log(`  [Sort: ${String(p.sortOrder).padStart(2, " ")}] ${p.name.padEnd(35)} | Family: ${p.family.padEnd(20)} | Problems: ${p.problems.length}`);
  });
}

main()
  .catch((e) => {
    console.error("Error merging patterns:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
