import { prisma } from "@/lib/prisma";
import { calculateRetrievability, type ReviewCardData } from "@/lib/scheduler";
import { getPatternCue } from "@/lib/cues";

export async function getDashboardSnapshot(userId: string, now: Date = new Date()) {
  const [attempts, entries, settings] = await Promise.all([
    prisma.attempt.findMany({
      where: { entry: { userId } },
      orderBy: { at: "desc" },
      include: { entry: { include: { problem: true } } },
    }),
    prisma.entry.findMany({
      where: { userId },
      include: {
        problem: { include: { patterns: { include: { pattern: true } } } },
        reviewCard: true,
        attempts: true,
      },
    }),
    prisma.userSettings.findUnique({ where: { userId } }),
  ]);

  const totalAttemptsCount = attempts.length;
  const coldSolveAttemptsCount = attempts.filter((a) => a.rating === "GOOD" || a.rating === "EASY").length;
  const coldSolveRate = totalAttemptsCount > 0 ? coldSolveAttemptsCount / totalAttemptsCount : 0;

  const minutesByDiff: Record<string, number[]> = { EASY: [], MEDIUM: [], HARD: [] };
  entries.forEach((entry) => {
    const diff = entry.problem.difficulty || "MEDIUM";
    if (entry.minutes != null && entry.minutes > 0) {
      minutesByDiff[diff].push(entry.minutes);
    }
  });

  const getMedian = (nums: number[]) => {
    if (nums.length === 0) return 0;
    const sorted = [...nums].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  };

  const stats = {
    coldSolveRate,
    totalAttempts: totalAttemptsCount,
    totalEntries: entries.length,
    medianMinutes: {
      EASY: getMedian(minutesByDiff.EASY),
      MEDIUM: getMedian(minutesByDiff.MEDIUM),
      HARD: getMedian(minutesByDiff.HARD),
    },
    leechCount: entries.filter((entry) => entry.reviewCard && entry.reviewCard.lapses >= 3).length,
  };

  const targetRetention = settings?.desiredRetention ?? 0.85;
  const patterns = await prisma.pattern.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      problems: {
        include: {
          problem: {
            include: { entries: { where: { userId }, include: { reviewCard: true } } },
          },
        },
      },
    },
  });

  const enrichedPatterns = patterns.map((pattern) => {
    const cards: Array<{
      card: ReviewCardData;
      problem: { id: string; title: string; number: number | null; url: string; difficulty: string | null };
    }> = [];

    pattern.problems.forEach((problemPattern) => {
      problemPattern.problem.entries.forEach((entry) => {
        if (entry.reviewCard) {
          cards.push({
            card: entry.reviewCard as ReviewCardData,
            problem: {
              id: problemPattern.problem.id,
              title: problemPattern.problem.title,
              number: problemPattern.problem.number,
              url: problemPattern.problem.url,
              difficulty: problemPattern.problem.difficulty,
            },
          });
        }
      });
    });

    const avgRetrievability = cards.length
      ? cards.reduce((sum, item) => sum + calculateRetrievability(item.card, now), 0) / cards.length
      : null;

    const reviewDates = cards
      .map((card) => (card.card.lastReview ? new Date(card.card.lastReview).getTime() : 0))
      .filter((time) => time > 0);
    const latestReview = reviewDates.length ? Math.max(...reviewDates) : null;
    const daysSinceReview = latestReview ? Math.floor((now.getTime() - latestReview) / (1000 * 60 * 60 * 24)) : null;

    return {
      id: pattern.id,
      name: pattern.name,
      family: pattern.family,
      cue: getPatternCue(pattern.name),
      avgRetrievability: avgRetrievability ?? 1.0,
      hasCards: cards.length > 0,
      cardCount: cards.length,
      daysSinceReview,
      isBelowTarget: avgRetrievability != null && avgRetrievability < targetRetention,
      isUntouched14Days: daysSinceReview == null ? cards.length > 0 : daysSinceReview >= 14,
      sampleProblems: cards.slice(0, 4).map((card) => card.problem),
    };
  });

  const belowTarget = enrichedPatterns.filter((pattern) => pattern.hasCards && pattern.isBelowTarget);
  const untouched14Days = enrichedPatterns.filter((pattern) => pattern.hasCards && pattern.isUntouched14Days && !pattern.isBelowTarget);
  const healthy = enrichedPatterns.filter((pattern) => pattern.hasCards && !pattern.isBelowTarget && !pattern.isUntouched14Days);

  const monthlyProblems = await prisma.problem.findMany({
    take: 5,
    include: {
      patterns: { include: { pattern: true } },
      entries: { where: { userId } },
    },
  });

  return {
    stats,
    weekly: {
      targetRetention,
      summary: {
        belowTargetCount: belowTarget.length,
        untouchedCount: untouched14Days.length,
        healthyCount: healthy.length,
      },
      belowTarget,
      untouched14Days,
      healthy,
    },
    monthly: {
      problemCount: monthlyProblems.length,
      problems: monthlyProblems.map((problem) => ({
        id: problem.id,
        entryId: problem.entries[0]?.id,
        title: problem.title,
        number: problem.number,
        url: problem.url,
        platform: problem.platform,
        patternName: problem.patterns[0]?.pattern.name || "General",
        difficulty: problem.difficulty,
      })),
    },
  };
}
