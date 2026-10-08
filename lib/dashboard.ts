import { prisma } from "@/lib/prisma";
import { deriveLane, failedRecallPending, fillResolveMinimum, hasQueueReview, interleaveQueue, neverSolvedCold, promoteOverdueToRecall, type LaneAttempt, type QueueItem, type ReviewLane } from "@/lib/scheduler";
import { localDay, startOfLocalDay } from "@/lib/dates";
import { getUserSettingsRow, DEFAULT_TIMEZONE } from "@/lib/user-settings";

const DEFAULT_RECALL_CAP = 5;
const DEFAULT_MIN_RESOLVE = 1;

export interface DashboardQueueItem extends QueueItem {
  lane: ReviewLane;
  problemId: string;
  title: string;
  number?: number | null;
  url: string;
  difficulty?: "EASY" | "MEDIUM" | "HARD" | null;
  platform: string;
  mistake?: string | null;
  idea?: string | null;
  retryTomorrow?: boolean;
}

export async function getDailyReviewQueue(userId: string, now: Date = new Date()) {
  const settings = await getUserSettingsRow(userId);
  const timezone = settings?.timezone ?? DEFAULT_TIMEZONE;
  const dayStart = startOfLocalDay(localDay(now, timezone), timezone);

  const [doneToday, dueCards, missedWeeklyChecks] = await Promise.all([
    // Caps are per local day: reviews already logged from the queue today use
    // up slots, so finishing a card doesn't pull the next one in.
    prisma.attempt.groupBy({
      by: ["lane"],
      where: { entry: { userId }, at: { gte: dayStart }, lane: { not: null } },
      _count: { _all: true },
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
              select: { rating: true, lane: true, at: true },
            },
          },
        },
      },
    }),
    prisma.weeklyCheck.findMany({
      where: { userId, at: { lt: dayStart } },
      orderBy: { at: "desc" },
      include: {
        entry: {
          select: {
            id: true,
            attempts: { orderBy: { at: "desc" }, take: 1, select: { at: true } },
            reviewCard: { select: { due: true, lapses: true, reps: true } },
            problem: {
              select: {
                id: true, title: true, number: true, url: true, difficulty: true, platform: true,
                patterns: { take: 1, select: { pattern: { select: { family: true } } } },
              },
            },
            idea: true,
            mistake: true,
            revisit: true,
          },
        },
      },
    }),
  ]);
  const doneIn = (lane: "RECALL" | "RESOLVE") =>
    doneToday.find((row) => row.lane === lane)?._count._all ?? 0;
  const resolveDone = doneIn("RESOLVE");
  const recallDone = doneIn("RECALL");
  const resolveLeft = Math.max(0, (settings?.dailyResolveCap ?? 2) - resolveDone);
  const recallLeft = Math.max(0, (settings?.dailyRecallCap ?? DEFAULT_RECALL_CAP) - recallDone);

  const queueItems: DashboardQueueItem[] = dueCards.map((card) => {
    const problem = card.entry.problem;
    const family = problem.patterns[0]?.pattern.family ?? null;
    const attempts = card.entry.attempts as LaneAttempt[];
    const recentRatings = attempts.map((a) => a.rating);
    const lastRating = recentRatings[0] ?? null;
    const revisit = card.entry.revisit ?? false;
    const needsFirstSolve = neverSolvedCold(attempts);
    const lane = deriveLane({
      reviewed: hasQueueReview(attempts),
      revisit,
      neverSolvedCold: needsFirstSolve,
      lapses: card.lapses,
      failedRecall: failedRecallPending(attempts),
    });

    return {
      entryId: card.entryId,
      due: card.due,
      lapses: card.lapses,
      reps: card.reps,
      family,
      lane,
      lastRating,
      revisit,
      neverSolvedCold: needsFirstSolve,
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

  // A weekly-check miss becomes a visible recall follow-up the next local day.
  // It remains outside ReviewCard.due, so the check itself never changes FSRS.
  const seenWeeklyEntries = new Set<string>();
  const dueIds = new Set(queueItems.map((item) => item.entryId));
  for (const check of missedWeeklyChecks) {
    const entry = check.entry;
    if (seenWeeklyEntries.has(entry.id)) continue;
    seenWeeklyEntries.add(entry.id);
    if (check.recalled) continue;
    if (dueIds.has(entry.id) || !entry.reviewCard) continue;
    if (entry.attempts[0] && entry.attempts[0].at > check.at) continue;
    const problem = entry.problem;
    queueItems.push({
      entryId: entry.id,
      due: check.at,
      lapses: entry.reviewCard.lapses,
      reps: entry.reviewCard.reps,
      family: problem.patterns[0]?.pattern.family ?? null,
      lane: "RECALL",
      lastRating: null,
      revisit: entry.revisit,
      problemId: problem.id,
      title: problem.title,
      number: problem.number,
      url: problem.url,
      difficulty: problem.difficulty,
      platform: problem.platform,
      mistake: entry.mistake,
      idea: entry.idea,
      retryTomorrow: true,
    });
  }

  // Only re-solves beyond what the day's cap can hold are demoted to a recall check; a lone
  // overdue re-solve keeps its slot.
  const resolveCandidates = queueItems.filter((item) => item.lane === "RESOLVE").length;
  const overdueItems = queueItems.filter((item) => new Date(item.due) < now);
  const promoted = promoteOverdueToRecall(overdueItems, Math.min(3, Math.max(0, resolveCandidates - resolveLeft)));
  const promotedById = new Map(promoted.map((item) => [item.entryId, item]));
  const originalLanes = new Map(queueItems.map((item) => [item.entryId, item.lane]));
  const promotedQueueItems = queueItems.map((item) => {
    const promotedItem = promotedById.get(item.entryId) ?? item;
    return promotedItem.lane === "RECALL" && originalLanes.get(item.entryId) === "RESOLVE"
      ? { ...promotedItem, retryTomorrow: true }
      : promotedItem;
  });

  // Daily floor of re-solves: today's finished ones count toward it, and the cap still bounds it.
  const minResolve = settings?.minDailyResolve ?? DEFAULT_MIN_RESOLVE;
  const wantResolve = Math.min(Math.max(0, minResolve - resolveDone), resolveLeft);
  const toppedUp = fillResolveMinimum(
    promotedQueueItems,
    wantResolve - promotedQueueItems.filter((item) => item.lane === "RESOLVE").length,
  );

  const finalQueue = interleaveQueue(toppedUp, resolveLeft, now, recallLeft);
  const resolveCount = finalQueue.filter((item) => item.lane === "RESOLVE").length;
  const recallCount = finalQueue.filter((item) => item.lane === "RECALL").length;

  // Same set getOverdueCount() counts (due strictly before now), taken from rows already loaded.
  const overdueCount = dueCards.filter((card) => card.due < now).length;

  return { queue: finalQueue, resolveCount, recallCount, doneToday: resolveDone + recallDone, overdueCount };
}

export async function getOverdueCount(userId: string, now: Date = new Date()) {
  return prisma.reviewCard.count({
    where: { entry: { userId }, due: { lt: now } },
  });
}

export async function getHeadlineStats(userId: string) {
  const [totalEntries, attemptsByRating, leechCount] = await Promise.all([
    prisma.entry.count({ where: { userId } }),
    prisma.attempt.groupBy({
      by: ["rating"],
      // Cold-solve rate means full re-solves from the queue; recall checks, logs and imports don't count.
      where: { entry: { userId }, source: "REVIEW", lane: "RESOLVE" },
      _count: { _all: true },
    }),
    prisma.reviewCard.count({
      where: { entry: { userId }, lapses: { gte: 3 } },
    }),
  ]);
  let totalAttempts = 0;
  let coldSolveAttempts = 0;
  for (const row of attemptsByRating) {
    totalAttempts += row._count._all;
    if (row.rating === "GOOD" || row.rating === "EASY") coldSolveAttempts += row._count._all;
  }

  return {
    totalEntries,
    coldSolveRate: totalAttempts > 0 ? coldSolveAttempts / totalAttempts : 0,
    totalAttempts,
    leechCount,
  };
}
