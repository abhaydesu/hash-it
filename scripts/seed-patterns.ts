import fs from "node:fs";
import path from "node:path";
import Papa from "papaparse";
import { PrismaClient, Platform, PatternSource } from "@prisma/client";
import { parseLeadingNumber, parseSlugFromUrl } from "../lib/import-utils";

const prisma = new PrismaClient();

interface PatternCsvRow {
  name: string;
  family: string;
  sortOrder: string;
}

interface RoadmapRow {
  pattern?: string;
  question?: string;
  link1?: string;
  link2?: string;
  link3?: string;
}

const PATTERN_ALIAS_MAP: Record<string, string> = {
  "two pointers": "Two Pointer",
  "two pointer": "Two Pointer",
  "fast slow pointer": "Fast and Slow Pointer",
  "fast and slow pointer": "Fast and Slow Pointer",
  "fast & slow pointer": "Fast and Slow Pointer",
  "fast & slow pointers": "Fast and Slow Pointer",
  "sliding window": "Sliding Window",
  "merge intervals": "Merge Intervals",
  "prefix sum": "Prefix Sum",
  "kadane pattern": "Kadane's Pattern",
  "kadane's pattern": "Kadane's Pattern",
  "in place reversal of linkedlist": "In-place Reversal of LinkedList",
  "in-place reversal of linkedlist": "In-place Reversal of LinkedList",
  "in-place reversal of a linkedlist": "In-place Reversal of LinkedList",
  "dummy node": "Dummy Node",
  "monotonic stack": "Monotonic Stack",
  "union find": "Union Find",
  "bit manipulation": "Bit Manipulation",
  "matrix traversal": "Matrix Traversal",
  "backtracking": "Backtracking",
  "bfs": "BFS",
  "dfs": "DFS",
  "topological sort": "Topological Sort",
  "dynamic programming": "Dynamic Programming",
  "greedy": "Greedy",
  "trie": "Trie",
  "intervals": "Intervals",
};

function normalizePatternKey(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function canonicalPatternName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "General Roadmap";
  const key = normalizePatternKey(trimmed);
  return PATTERN_ALIAS_MAP[key] ?? trimmed;
}

function familyForPattern(name: string): string {
  const canonical = canonicalPatternName(name);
  const defaults: Record<string, string> = {
    "Two Pointer": "Pointers",
    "Fast and Slow Pointer": "Pointers",
    "Sliding Window": "Sliding & Array",
    "Merge Intervals": "Intervals",
    "Prefix Sum": "Sliding & Array",
    "Kadane's Pattern": "Sliding & Array",
    "In-place Reversal of LinkedList": "Pointers",
    "Dummy Node": "Pointers",
    "Stack": "Hashing & Linear",
    "HashMap": "Hashing & Linear",
    "Heap": "Hashing & Linear",
    "Binary Search": "Search & Math",
    "Backtracking": "Search & Math",
    "BFS": "Trees & Graphs",
    "DFS": "Trees & Graphs",
    "Topological Sort": "Trees & Graphs",
    "Dynamic Programming": "DP & Greedy",
    "Greedy": "DP & Greedy",
    "Trie": "Trees & Graphs",
    "Union Find": "Trees & Graphs",
    "Bit Manipulation": "Search & Math",
    "Matrix Traversal": "Trees & Graphs",
    "Monotonic Stack": "Hashing & Linear",
    "Intervals": "Intervals",
  };

  return defaults[canonical] ?? "General";
}

function getQuestionAndUrls(row: string[]) {
  const question = (row[1] || "").trim();
  const links = [row[2], row[3], row[4]].filter((value) => typeof value === "string" && value.trim().startsWith("http")).map((value) => value.trim());
  return { question, links };
}

async function seedCanonicalPatternTaxonomy() {
  const dataDir = path.join(process.cwd(), "data");
  const patternsPath = path.join(dataDir, "patterns.csv");
  if (!fs.existsSync(patternsPath)) return 0;

  const csv = fs.readFileSync(patternsPath, "utf-8");
  const parsed = Papa.parse<PatternCsvRow>(csv, { header: true, skipEmptyLines: true });

  let seeded = 0;
  for (const row of parsed.data) {
    if (!row.name || !row.family) continue;
    const name = row.name.trim();
    await prisma.pattern.upsert({
      where: { name },
      update: {
        family: row.family.trim(),
        sortOrder: Number.parseInt(row.sortOrder, 10) || 0,
      },
      create: {
        name,
        family: row.family.trim(),
        sortOrder: Number.parseInt(row.sortOrder, 10) || 0,
      },
    });
    seeded++;
  }

  return seeded;
}

export async function seedPatternsAndStarterProblems() {
  console.log("==> Seeding pattern mappings from roadmap CSV...");

  const dataDir = path.join(process.cwd(), "data");
  const roadMapPath = path.join(dataDir, "youtuber-roadmap.csv");
  if (!fs.existsSync(roadMapPath)) {
    throw new Error(`Roadmap CSV not found at ${roadMapPath}`);
  }

  const seededPatterns = await seedCanonicalPatternTaxonomy();
  console.log(`[OK] Seeded ${seededPatterns} canonical patterns.`);

  const csvText = fs.readFileSync(roadMapPath, "utf-8");
  const rows = Papa.parse<string[]>(csvText, { header: false, skipEmptyLines: "greedy" }).data;

  let currentPatternName = "General Roadmap";
  let mappedCount = 0;
  let unmatchedCount = 0;
  const unmatchedRows: string[][] = [];

  for (const row of rows) {
    if (!row || row.length < 2) continue;

    const col0 = (row[0] || "").trim();
    const col1 = (row[1] || "").trim();
    const link1 = (row[2] || "").trim();
    const link2 = (row[3] || "").trim();
    const link3 = (row[4] || "").trim();
    const isHeading =
      (!link1 && !link2 && !link3 && col1.length > 0 && !col1.startsWith("http")) ||
      col1.toLowerCase().includes("pattern:") ||
      col1.toLowerCase().startsWith("pattern ") ||
      col0.toLowerCase().includes("pattern");

    if (isHeading) {
      const rawHeading = [col0, col1].filter(Boolean).join(" ").trim();
      currentPatternName = (rawHeading.match(/pattern[:\s-]+(.+)/i)?.[1] ?? rawHeading).trim() || "General Roadmap";
      continue;
    }

    if (!col1 && !link1) continue;
    const { question, links } = getQuestionAndUrls(row);
    if (!question && links.length === 0) continue;

    const canonicalName = canonicalPatternName(currentPatternName || "General Roadmap");
    const pattern = await prisma.pattern.upsert({
      where: { name: canonicalName },
      update: { family: familyForPattern(canonicalName), sortOrder: 999 },
      create: { name: canonicalName, family: familyForPattern(canonicalName), sortOrder: 999 },
    });

    let problem = null as Awaited<ReturnType<typeof prisma.problem.findFirst>> | null;
    const explicitNumber = parseLeadingNumber(question);
    if (explicitNumber != null) {
      problem = await prisma.problem.findFirst({
        where: { number: explicitNumber, platform: Platform.LEETCODE },
      });
    }

    if (!problem) {
      for (const link of links) {
        const slug = parseSlugFromUrl(link);
        if (slug) {
          problem = await prisma.problem.findFirst({
            where: { slug, platform: Platform.LEETCODE },
          });
          if (problem) break;
        }
      }
    }

    if (!problem && question) {
      const sanitizedQuestion = question.replace(/^\d+[\s.\-]+/, "").trim();
      const keyword = sanitizedQuestion.replace(/[\s]+/g, " ").trim();
      if (keyword) {
        problem = await prisma.problem.findFirst({
          where: {
            title: { contains: keyword, mode: "insensitive" },
            platform: Platform.LEETCODE,
          },
        });
      }
    }

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
          source: PatternSource.SHEET,
        },
      });
      mappedCount++;
    } else {
      unmatchedCount++;
      unmatchedRows.push(row);
    }
  }

  const unmatchedPath = path.join(dataDir, "unmatched.csv");
  const csvOutput = Papa.unparse(unmatchedRows);
  fs.writeFileSync(unmatchedPath, csvOutput, "utf-8");

  const patternCount = await prisma.pattern.count();
  const mappingCount = await prisma.problemPattern.count();

  if (patternCount < 18) {
    throw new Error(`Pattern seeding failed: expected at least 18 patterns, found ${patternCount}.`);
  }

  if (mappingCount < 150) {
    throw new Error(`Pattern seeding failed: expected at least 150 canonical mappings, found ${mappingCount}.`);
  }

  console.log(`Summary: ${patternCount} patterns, ${mappingCount} problem-pattern mappings, ${unmatchedCount} unmatched rows written to ${unmatchedPath}.`);
  return { patternCount, mappingCount, unmatchedCount, matchedCount: mappedCount };
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
