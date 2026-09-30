import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { primaryPattern } from "@/lib/pattern-classifier";

/** Tag for everything derived from the shared problem catalog; revalidate it after catalog writes. */
export const CATALOG_CACHE_TAG = "problem-catalog";

/** Patterns created on the fly by imports (e.g. "Basics, Stack") are entry labels, not practice topics. */
const IMPORTED_FAMILY = "Imported";

export interface PracticeProblem {
  id: string;
  title: string;
  number: number | null;
  url: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  platform: string;
  isLogged: boolean;
}

export interface PracticePattern {
  id: string;
  name: string;
  family: string;
  problemCount: number;
}

type Candidate = Omit<PracticeProblem, "isLogged">;

interface PatternBuckets {
  patterns: Array<{ id: string; name: string; family: string }>;
  problems: Candidate[];
  /** patternId → indexes into `problems`. Plain JSON so it can live in the data cache. */
  bucketIndexes: Record<string, number[]>;
}

/**
 * Buckets every free, rated problem into practice patterns. Curated sheet links
 * win; otherwise the problem goes to its single primary pattern by topic tags,
 * so counts don't double-count and a DP problem tagged "Array" stays DP.
 */
export async function computePatternBuckets(): Promise<PatternBuckets> {
  const [patterns, problems] = await Promise.all([
    prisma.pattern.findMany({
      where: { family: { not: IMPORTED_FAMILY } },
      select: { id: true, name: true, family: true },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.problem.findMany({
      where: { isPaidOnly: false, difficulty: { not: null } },
      select: {
        id: true,
        title: true,
        number: true,
        url: true,
        difficulty: true,
        platform: true,
        topicTags: true,
        patterns: { select: { patternId: true } },
      },
    }),
  ]);

  const idByName = new Map(patterns.map((p) => [p.name, p.id]));
  const bucketIndexes: Record<string, number[]> = Object.fromEntries(patterns.map((p) => [p.id, []]));
  const candidates: Candidate[] = [];

  for (const { topicTags, patterns: links, ...problem } of problems) {
    const candidate = problem as Candidate;
    const curated = links.map((l) => l.patternId).filter((id) => id in bucketIndexes);
    const name = curated.length > 0 ? null : primaryPattern(topicTags, problem.title);
    const primary = name ? idByName.get(name) : undefined;
    const targets = curated.length > 0 ? curated : primary ? [primary] : [];
    if (targets.length === 0) continue;
    const index = candidates.push(candidate) - 1;
    for (const id of targets) bucketIndexes[id].push(index);
  }

  return { patterns, problems: candidates, bucketIndexes };
}

/**
 * The catalog is shared by every user and changes only on sync or when a new problem
 * is logged, so the bucketing (a full catalog scan) is cached instead of redone on
 * every visit and every shuffle.
 */
const cachedPatternBuckets = unstable_cache(computePatternBuckets, ["practice-pattern-buckets-v1"], {
  revalidate: 3600,
  tags: [CATALOG_CACHE_TAG],
});

async function loadPatternBuckets() {
  const { patterns, problems, bucketIndexes } = await cachedPatternBuckets();
  const buckets = new Map(patterns.map((p) => [p.id, (bucketIndexes[p.id] ?? []).map((i) => problems[i])]));
  return { patterns, buckets };
}

export async function getPracticeProblems(
  patternId: string,
  userId: string
): Promise<{ easy: PracticeProblem | null; medium: PracticeProblem | null; hard: PracticeProblem | null }> {
  const [{ buckets }, loggedEntries] = await Promise.all([
    loadPatternBuckets(),
    prisma.entry.findMany({ where: { userId }, select: { problemId: true } }),
  ]);
  const loggedSet = new Set(loggedEntries.map((e) => e.problemId));
  const bucket = buckets.get(patternId) ?? [];

  const pickOne = (difficulty: Candidate["difficulty"]): PracticeProblem | null => {
    const candidates = bucket.filter((c) => c.difficulty === difficulty);
    if (candidates.length === 0) return null;
    // Prefer problems the user hasn't logged yet.
    const unlogged = candidates.filter((c) => !loggedSet.has(c.id));
    const pool = unlogged.length > 0 ? unlogged : candidates;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    return { ...pick, isLogged: loggedSet.has(pick.id) };
  };

  return { easy: pickOne("EASY"), medium: pickOne("MEDIUM"), hard: pickOne("HARD") };
}

export async function getPracticePatterns(): Promise<PracticePattern[]> {
  const { patterns, buckets } = await loadPatternBuckets();
  return patterns
    .map((p) => ({ ...p, problemCount: buckets.get(p.id)!.length }))
    .filter((p) => p.problemCount > 0);
}
