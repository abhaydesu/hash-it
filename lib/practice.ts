import { prisma } from "@/lib/prisma";

const PATTERN_TAG_MAP: Record<string, string[]> = {
  "Basics": ["Array"],
  "Two Pointer": ["Two Pointers"],
  "Fast and Slow Pointer": ["Two Pointers", "Linked List"],
  "Sliding Window": ["Sliding Window"],
  "Merge Intervals": ["Sorting", "Array"],
  "Prefix Sum": ["Prefix Sum"],
  "Kadane's Pattern": ["Dynamic Programming", "Array"],
  "In-place Reversal of LinkedList": ["Linked List"],
  "Dummy Node": ["Linked List"],
  "Stack": ["Stack"],
  "HashMap": ["Hash Table"],
  "Heap": ["Heap (Priority Queue)"],
  "Binary Search": ["Binary Search"],
  "Backtracking": ["Backtracking"],
  "BFS": ["Breadth-First Search"],
  "DFS": ["Depth-First Search"],
  "Topological Sort": ["Topological Sort"],
  "Dynamic Programming": ["Dynamic Programming"],
  "Greedy": ["Greedy"],
  "Trie": ["Trie"],
  "Union Find": ["Union-Find"],
  "Bit Manipulation": ["Bit Manipulation"],
  "Matrix Traversal": ["Matrix"],
  "Monotonic Stack": ["Monotonic Stack"],
  "Intervals": ["Sorting", "Array"],
  "Hash Table": ["Hash Table"],
};

function getTagsForPattern(patternName: string): string[] {
  for (const [key, tags] of Object.entries(PATTERN_TAG_MAP)) {
    if (patternName.toLowerCase().includes(key.toLowerCase())) {
      return tags;
    }
  }
  return [];
}

export interface PracticeProblem {
  id: string;
  title: string;
  number: number | null;
  url: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  platform: string;
  isLogged: boolean;
}

export async function getPracticeProblems(
  patternId: string,
  userId: string
): Promise<{ easy: PracticeProblem | null; medium: PracticeProblem | null; hard: PracticeProblem | null }> {
  const pattern = await prisma.pattern.findUnique({
    where: { id: patternId },
    select: { name: true, problems: { select: { problemId: true } } },
  });
  if (!pattern) return { easy: null, medium: null, hard: null };

  const tags = getTagsForPattern(pattern.name);
  const linkedIds = pattern.problems.map((p) => p.problemId);

  const loggedEntries = await prisma.entry.findMany({
    where: { userId },
    select: { problemId: true },
  });
  const loggedSet = new Set(loggedEntries.map((e) => e.problemId));

  const pickOne = async (
    difficulty: "EASY" | "MEDIUM" | "HARD"
  ): Promise<PracticeProblem | null> => {
    // Strategy: first try unlogged problems matching tags, then logged, then any with tags
    const baseWhere = {
      difficulty,
      isPaidOnly: false,
    };

    // Build tag filter: problems linked to this pattern OR matching topicTags
    const orConditions: Array<Record<string, unknown>> = [];
    if (linkedIds.length > 0) {
      orConditions.push({ id: { in: linkedIds } });
    }
    if (tags.length > 0) {
      orConditions.push({ topicTags: { hasSome: tags } });
    }
    if (orConditions.length === 0) return null;

    const candidates = await prisma.problem.findMany({
      where: {
        ...baseWhere,
        OR: orConditions,
      },
      select: {
        id: true,
        title: true,
        number: true,
        url: true,
        difficulty: true,
        platform: true,
      },
      take: 200,
    });

    if (candidates.length === 0) return null;

    // Prefer unlogged problems
    const unlogged = candidates.filter((c) => !loggedSet.has(c.id));
    const pool = unlogged.length > 0 ? unlogged : candidates;
    const pick = pool[Math.floor(Math.random() * pool.length)];

    return {
      id: pick.id,
      title: pick.title,
      number: pick.number,
      url: pick.url,
      difficulty: pick.difficulty as "EASY" | "MEDIUM" | "HARD",
      platform: pick.platform,
      isLogged: loggedSet.has(pick.id),
    };
  };

  const [easy, medium, hard] = await Promise.all([
    pickOne("EASY"),
    pickOne("MEDIUM"),
    pickOne("HARD"),
  ]);

  return { easy, medium, hard };
}

export interface PracticePattern {
  id: string;
  name: string;
  family: string;
  problemCount: number;
}

export async function getPracticePatterns(): Promise<PracticePattern[]> {
  const patterns = await prisma.pattern.findMany({
    select: {
      id: true,
      name: true,
      family: true,
      sortOrder: true,
      _count: { select: { problems: true } },
    },
    orderBy: { sortOrder: "asc" },
  });

  // Batch: count tag-matched problems for patterns with sparse direct links
  const needsTagCount = patterns.filter(
    (p) => p._count.problems < 10 && getTagsForPattern(p.name).length > 0
  );
  const tagCounts = await Promise.all(
    needsTagCount.map((p) =>
      prisma.problem
        .count({
          where: {
            isPaidOnly: false,
            difficulty: { not: null },
            topicTags: { hasSome: getTagsForPattern(p.name) },
          },
        })
        .then((count) => ({ id: p.id, count }))
    )
  );
  const tagCountMap = new Map(tagCounts.map((tc) => [tc.id, tc.count]));

  return patterns
    .map((p) => ({
      id: p.id,
      name: p.name,
      family: p.family,
      problemCount: tagCountMap.get(p.id) ?? p._count.problems,
    }))
    .filter((p) => p.problemCount > 0);
}
