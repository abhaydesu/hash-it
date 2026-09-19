import { prisma } from "@/lib/prisma";
import { deriveLane, interleaveQueue, type AppRating } from "@/lib/scheduler";

const RECALL_CAP = 6;

export async function getDailyReviewQueue(userId: string, now: Date = new Date()) {
  const [settings, dueCards] = await Promise.all([
    prisma.userSettings.findUnique({
      where: { userId },
      select: { dailyResolveCap: true },
    }),
    prisma.reviewCard.findMany({
      where: {
        entry: { userId },
        due: { lte: now },
      },
      select: {
        entryId: true,
        due: true,
        lapses: true,
        reps: true,
        stability: true,
        entry: {
          select: {
            mistake: true,
            idea: true,
            revisit: true,
            problem: {
              select: {
                id: true,
                title: true,
                number: true,
                url: true,
                difficulty: true,
                platform: true,
                patterns: {
                  take: 1,
                  select: { pattern: { select: { family: true } } },
                },
              },
            },
            attempts: {
              orderBy: { at: "desc" },
              take: 1,
              select: { rating: true },
            },
          },
        },
      },
    }),
  ]);
  const resolveCap = settings?.dailyResolveCap ?? 2;

  const queueItems = dueCards.map((card) => {
    const problem = card.entry.problem;
    const family = problem.patterns[0]?.pattern.family ?? null;
    const lastAttempt = card.entry.attempts[0];
    const lastRating = (lastAttempt?.rating ?? null) as AppRating | null;
    const revisit = card.entry.revisit ?? false;
    const lane = deriveLane({ lastRating, lapses: card.lapses, stability: card.stability });

    return {
      entryId: card.entryId,
      due: card.due,
      lapses: card.lapses,
      reps: card.reps,
      family,
      lane,
      lastRating,
      revisit,
      problemId: problem.id,
      title: problem.title,
      number: problem.number,
      url: problem.url,
      difficulty: problem.difficulty,
      platform: problem.platform,
      mistake: card.entry.mistake,
      idea: card.entry.idea,
    };
  });

  const finalQueue = interleaveQueue(queueItems, resolveCap, now, RECALL_CAP);
  const resolveCount = finalQueue.filter((item) => item.lane === "RESOLVE").length;
  const recallCount = finalQueue.filter((item) => item.lane === "RECALL").length;

  return { queue: finalQueue, resolveCount, recallCount };
}

export async function getOverdueCount(userId: string, now: Date = new Date()) {
  return prisma.reviewCard.count({
    where: { entry: { userId }, due: { lt: now } },
  });
}

export async function getHeadlineStats(userId: string) {
  const [totalEntries, totalAttempts, coldSolveAttempts, leechCount] = await Promise.all([
    prisma.entry.count({ where: { userId } }),
    prisma.attempt.count({ where: { entry: { userId } } }),
    prisma.attempt.count({
      where: { entry: { userId }, rating: { in: ["GOOD", "EASY"] } },
    }),
    prisma.reviewCard.count({
      where: { entry: { userId }, lapses: { gte: 3 } },
    }),
  ]);

  return {
    totalEntries,
    coldSolveRate: totalAttempts > 0 ? coldSolveAttempts / totalAttempts : 0,
    leechCount,
  };
}
