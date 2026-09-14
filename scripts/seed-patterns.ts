import fs from "node:fs";
import path from "node:path";
import Papa from "papaparse";
import { PrismaClient, Platform, Difficulty } from "@prisma/client";

const prisma = new PrismaClient();

interface PatternCsvRow {
  name: string;
  family: string;
  sortOrder: string;
}

interface ProblemPatternCsvRow {
  pattern: string;
  leetcode_slug_or_number: string;
}

interface StarterProblem {
  number: number;
  slug: string;
  title: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  acRate: number;
  isPaidOnly: boolean;
  topicTags: string[];
}

export async function seedPatternsAndStarterProblems() {
  console.log("==> Seeding patterns and taxonomy...");

  const dataDir = path.join(process.cwd(), "data");

  // 1. Seed patterns from patterns.csv
  const patternsCsvPath = path.join(dataDir, "patterns.csv");
  if (fs.existsSync(patternsCsvPath)) {
    const csvContent = fs.readFileSync(patternsCsvPath, "utf-8");
    const parsed = Papa.parse<PatternCsvRow>(csvContent, { header: true, skipEmptyLines: true });

    for (const row of parsed.data) {
      if (!row.name || !row.family) continue;
      await prisma.pattern.upsert({
        where: { name: row.name.trim() },
        update: {
          family: row.family.trim(),
          sortOrder: parseInt(row.sortOrder, 10) || 0,
        },
        create: {
          name: row.name.trim(),
          family: row.family.trim(),
          sortOrder: parseInt(row.sortOrder, 10) || 0,
        },
      });
    }
    console.log(`[OK] Seeded ${parsed.data.length} patterns.`);
  }

  // 2. Seed starter problems from starter-problems.json if exists
  const starterPath = path.join(dataDir, "starter-problems.json");
  if (fs.existsSync(starterPath)) {
    const raw = fs.readFileSync(starterPath, "utf-8");
    const starterProblems: StarterProblem[] = JSON.parse(raw);

    for (const prob of starterProblems) {
      await prisma.problem.upsert({
        where: {
          platform_slug: {
            platform: Platform.LEETCODE,
            slug: prob.slug,
          },
        },
        update: {
          number: prob.number,
          title: prob.title,
          url: `https://leetcode.com/problems/${prob.slug}/`,
          difficulty: prob.difficulty as Difficulty,
          acRate: prob.acRate,
          isPaidOnly: prob.isPaidOnly,
          topicTags: prob.topicTags,
          lastSyncedAt: new Date(),
        },
        create: {
          platform: Platform.LEETCODE,
          slug: prob.slug,
          number: prob.number,
          title: prob.title,
          url: `https://leetcode.com/problems/${prob.slug}/`,
          difficulty: prob.difficulty as Difficulty,
          acRate: prob.acRate,
          isPaidOnly: prob.isPaidOnly,
          topicTags: prob.topicTags,
          lastSyncedAt: new Date(),
        },
      });
    }
    console.log(`[OK] Seeded ${starterProblems.length} starter canonical problems.`);
  }

  // 3. Seed problem-patterns mapping from problem-patterns.csv
  const probPatternsCsvPath = path.join(dataDir, "problem-patterns.csv");
  if (fs.existsSync(probPatternsCsvPath)) {
    const csvContent = fs.readFileSync(probPatternsCsvPath, "utf-8");
    const parsed = Papa.parse<ProblemPatternCsvRow>(csvContent, { header: true, skipEmptyLines: true });

    let mappedCount = 0;
    for (const row of parsed.data) {
      if (!row.pattern || !row.leetcode_slug_or_number) continue;
      const patternName = row.pattern.trim();
      const ref = row.leetcode_slug_or_number.trim();

      const pattern = await prisma.pattern.findUnique({ where: { name: patternName } });
      if (!pattern) continue;

      const asNum = parseInt(ref, 10);
      const problem = await prisma.problem.findFirst({
        where: isNaN(asNum)
          ? { slug: ref, platform: Platform.LEETCODE }
          : { OR: [{ number: asNum }, { slug: ref }], platform: Platform.LEETCODE },
      });

      if (problem) {
        await prisma.problemPattern.upsert({
          where: {
            problemId_patternId: {
              problemId: problem.id,
              patternId: pattern.id,
            },
          },
          update: {},
          create: {
            problemId: problem.id,
            patternId: pattern.id,
          },
        });
        mappedCount++;
      }
    }
    console.log(`[OK] Seeded ${mappedCount} canonical problem-pattern associations.`);
  }

  const patternCount = await prisma.pattern.count();
  const problemCount = await prisma.problem.count();
  const mappingCount = await prisma.problemPattern.count();
  console.log(`Summary: ${patternCount} patterns, ${problemCount} problems, ${mappingCount} problem-pattern mappings.`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seedPatternsAndStarterProblems()
    .catch((err) => {
      console.error("Error seeding patterns:", err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
