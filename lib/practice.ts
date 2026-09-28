import { prisma } from "@/lib/prisma";
import { primaryPattern } from "@/lib/pattern-classifier";

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

/**
 * Buckets every free, rated problem into practice patterns. Curated sheet links
 * win; otherwise the problem goes to its single primary pattern by topic tags,
 * so counts don't double-count and a DP problem tagged "Array" stays DP.
 */
async function loadPatternBuckets() {
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
  const buckets = new Map<string, Candidate[]>(patterns.map((p) => [p.id, []]));

  for (const { topicTags, patterns: links, ...problem } of problems) {
    const candidate = problem as Candidate;
    const curated = links.map((l) => l.patternId).filter((id) => buckets.has(id));
    if (curated.length > 0) {
      for (const id of curated) buckets.get(id)!.push(candidate);
      continue;
    }
    const name = primaryPattern(topicTags, problem.title);
    const id = name ? idByName.get(name) : undefined;
    if (id) buckets.get(id)!.push(candidate);
  }

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
