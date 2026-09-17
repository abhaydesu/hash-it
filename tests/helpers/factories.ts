import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

let counter = 1;
function uniqueId(prefix: string) {
  return `${prefix}_${Date.now()}_${counter++}_${Math.random().toString(36).substring(2, 7)}`;
}

export async function createTestUser(
  overrides?: Partial<Prisma.UserCreateInput>,
  db = prisma
) {
  const id = overrides?.id || uniqueId("usr");
  const email = overrides?.email || `${id}@example.com`;
  return await db.user.create({
    data: {
      id,
      email,
      name: overrides?.name ?? `Test User ${id}`,
      ...overrides,
    },
  });
}

export async function createTestProblem(
  overrides?: Partial<Prisma.ProblemCreateInput>,
  db = prisma
) {
  const id = overrides?.id || uniqueId("prob");
  const slug = overrides?.slug || `problem-${id}`;
  return await db.problem.create({
    data: {
      id,
      slug,
      title: overrides?.title ?? `Problem Title ${id}`,
      url: overrides?.url ?? `https://leetcode.com/problems/${slug}/`,
      platform: overrides?.platform ?? "LEETCODE",
      difficulty: overrides?.difficulty ?? "MEDIUM",
      topicTags: overrides?.topicTags ?? ["Array"],
      ...overrides,
    },
  });
}

export async function createTestPattern(
  overrides?: Partial<Prisma.PatternCreateInput>,
  db = prisma
) {
  const id = overrides?.id || uniqueId("pat");
  return await db.pattern.create({
    data: {
      id,
      name: overrides?.name ?? `Pattern ${id}`,
      family: overrides?.family ?? "Two Pointers",
      sortOrder: overrides?.sortOrder ?? counter++,
      ...overrides,
    },
  });
}

export async function createTestPatternProblem(
  problemId: string,
  patternId: string,
  source: "SHEET" | "USER" = "SHEET",
  db = prisma
) {
  return await db.problemPattern.create({
    data: {
      problemId,
      patternId,
      source,
    },
  });
}

export async function createTestEntry(
  userId: string,
  problemId: string,
  overrides?: Partial<Prisma.EntryUncheckedCreateInput> & {
    createAttempt?: boolean;
    createReviewCard?: boolean;
    cardState?: "NEW" | "LEARNING" | "REVIEW" | "RELEARNING";
    due?: Date;
    attemptRating?: "AGAIN" | "HARD" | "GOOD" | "EASY";
  },
  db = prisma
) {
  const id = overrides?.id || uniqueId("ent");
  const {
    createAttempt,
    createReviewCard,
    cardState,
    due,
    attemptRating,
    ...entryData
  } = overrides || {};

  const entry = await db.entry.create({
    data: {
      id,
      userId,
      problemId,
      status: entryData.status ?? "SOLVED_UNAIDED",
      firstSolvedAt: entryData.firstSolvedAt ?? new Date(),
      minutes: entryData.minutes ?? 20,
      revisit: entryData.revisit ?? false,
      patternOverride: entryData.patternOverride ?? [],
      ...entryData,
    },
  });

  let attempt;
  if (createAttempt) {
    attempt = await db.attempt.create({
      data: {
        entryId: entry.id,
        rating: attemptRating ?? "GOOD",
        minutes: entry.minutes,
        at: entry.firstSolvedAt,
      },
    });
  }

  let reviewCard;
  if (createReviewCard) {
    reviewCard = await db.reviewCard.create({
      data: {
        entryId: entry.id,
        due: due ?? new Date(),
        stability: 2.5,
        difficulty: 4.5,
        elapsedDays: 0,
        scheduledDays: 1,
        reps: 1,
        lapses: 0,
        state: cardState ?? "REVIEW",
        lastReview: new Date(),
      },
    });
  }

  return { entry, attempt, reviewCard };
}

export async function createTestUserSettings(
  userId: string,
  overrides?: Partial<Prisma.UserSettingsUncheckedCreateInput>,
  db = prisma
) {
  return await db.userSettings.create({
    data: {
      userId,
      dailyResolveCap: overrides?.dailyResolveCap ?? 2,
      desiredRetention: overrides?.desiredRetention ?? 0.8,
      timezone: overrides?.timezone ?? "Asia/Kolkata",
      easyBaseline: overrides?.easyBaseline ?? 15,
      mediumBaseline: overrides?.mediumBaseline ?? 30,
      hardBaseline: overrides?.hardBaseline ?? 45,
      fsrsParams: overrides?.fsrsParams ?? [],
      ...overrides,
    },
  });
}
