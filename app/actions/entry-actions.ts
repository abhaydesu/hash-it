"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import {
  seedCard,
  advanceCard,
  deriveRating,
  type SolveStatusType,
  type ProblemDifficulty,
  type AppRating,
} from "@/lib/scheduler";
import { Platform, Difficulty, SolveStatus, Rating, CardState } from "@prisma/client";
import { LIMITS, storedHttpUrl } from "@/lib/safe";
import { parseSlugFromUrl } from "@/lib/problem-url";

const CreateEntrySchema = z.object({
  problemId: z.string().max(64).optional(),
  // For manual problem creation if problemId is omitted:
  manualTitle: z.string().max(LIMITS.title).optional(),
  manualUrl: z.string().max(LIMITS.url).optional(),
  manualPlatform: z.enum(["LEETCODE", "GFG", "OTHER"]).default("OTHER"),
  manualDifficulty: z.enum(["EASY", "MEDIUM", "HARD"]).optional(),
  manualTopicTags: z.array(z.string().max(80)).max(30).default([]),

  status: z.enum(["SOLVED_UNAIDED", "SOLVED_WITH_HELP", "ATTEMPTED_FAILED"]),
  minutes: z.number().int().min(0).max(1000).optional().nullable(),
  idea: z.string().max(LIMITS.note).optional().nullable(),
  mistake: z.string().max(LIMITS.note).optional().nullable(),
  sourceList: z.string().max(200).optional().nullable(),
  revisit: z.boolean().default(false),
  patternOverride: z.array(z.string().max(120)).max(20).default([]),
});

export async function createEntry(input: z.input<typeof CreateEntrySchema>) {
  const user = await getCurrentUser();
  const data = CreateEntrySchema.parse(input);

  let targetProblemId = data.problemId;

  // Handle manual problem creation if problemId not supplied
  if (!targetProblemId) {
    if (!data.manualTitle && !data.manualUrl) {
      throw new Error("Either a problem selection or manual title/url must be provided");
    }

    const title = data.manualTitle || "Untitled Problem";
    let slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const urlSlug = data.manualUrl ? parseSlugFromUrl(data.manualUrl) : null;
    if (urlSlug) slug = urlSlug;

    const platform = data.manualPlatform as Platform;
    const finalSlug = slug || `problem-${Date.now()}`;
    const newProblem = await prisma.problem.upsert({
      where: { platform_slug: { platform, slug: finalSlug } },
      update: {
        ...(data.manualTitle ? { title } : {}),
        ...(data.manualUrl ? { url: storedHttpUrl(data.manualUrl) } : {}),
        ...(data.manualDifficulty ? { difficulty: data.manualDifficulty as Difficulty } : {}),
        ...(data.manualTopicTags.length > 0 ? { topicTags: data.manualTopicTags } : {}),
      },
      create: {
        platform,
        slug: finalSlug,
        title,
        url: storedHttpUrl(data.manualUrl),
        difficulty: data.manualDifficulty as Difficulty | null,
        topicTags: data.manualTopicTags,
      },
    });
    targetProblemId = newProblem.id;
  }

  // Look up problem to get difficulty for baselines
  const problem = await prisma.problem.findUniqueOrThrow({
    where: { id: targetProblemId },
    select: { id: true, difficulty: true },
  });

  // Check if entry already exists
  const existingEntry = await prisma.entry.findUnique({
    where: {
      userId_problemId: {
        userId: user.id,
        problemId: targetProblemId,
      },
    },
    include: { reviewCard: true },
  });

  const now = new Date();

  if (existingEntry) {
    // Spec §3: Re-solving a problem never creates a second Entry. It appends an Attempt and advances ReviewCard.
    const userSettings = await prisma.userSettings.findUnique({
      where: { userId: user.id },
    });

    const baselines = userSettings
      ? {
          easy: userSettings.easyBaseline,
          medium: userSettings.mediumBaseline,
          hard: userSettings.hardBaseline,
        }
      : undefined;

    const rating = deriveRating({
      status: data.status as SolveStatusType,
      minutes: data.minutes,
      usedHint: data.status === "SOLVED_WITH_HELP",
      difficulty: problem.difficulty as ProblemDifficulty | null,
      baselines,
    });

    let updatedCardData;
    if (existingEntry.reviewCard) {
      updatedCardData = advanceCard({
        currentCard: {
          entryId: existingEntry.id,
          due: existingEntry.reviewCard.due,
          stability: existingEntry.reviewCard.stability,
          difficulty: existingEntry.reviewCard.difficulty,
          elapsedDays: existingEntry.reviewCard.elapsedDays,
          scheduledDays: existingEntry.reviewCard.scheduledDays,
          reps: existingEntry.reviewCard.reps,
          lapses: existingEntry.reviewCard.lapses,
          state: existingEntry.reviewCard.state as any,
          lastReview: existingEntry.reviewCard.lastReview,
        },
        rating,
        reviewDate: now,
        desiredRetention: userSettings?.desiredRetention ?? 0.80,
        fsrsParams: userSettings?.fsrsParams ?? [],
      });
    } else {
      updatedCardData = seedCard({
        entryId: existingEntry.id,
        status: data.status as SolveStatusType,
        revisit: data.revisit,
        now,
        desiredRetention: userSettings?.desiredRetention ?? 0.80,
        fsrsParams: userSettings?.fsrsParams ?? [],
      });
    }

    const [updatedEntry, attempt] = await prisma.$transaction([
      prisma.entry.update({
        where: { id: existingEntry.id },
        data: {
          status: data.status as SolveStatus,
          idea: data.idea ?? existingEntry.idea,
          mistake: data.mistake ?? existingEntry.mistake,
          revisit: data.revisit,
          minutes: data.minutes ?? existingEntry.minutes,
          patternOverride: data.patternOverride.length > 0 ? data.patternOverride : existingEntry.patternOverride,
          topic:
            data.manualTopicTags[0] ||
            data.patternOverride[0] ||
            existingEntry.topic,
        },
      }),
      prisma.attempt.create({
        data: {
          entryId: existingEntry.id,
          at: now,
          rating: rating as Rating,
          minutes: data.minutes,
          usedHint: data.status === "SOLVED_WITH_HELP",
          note: data.idea ? `Logged: ${data.idea.slice(0, 80)}` : null,
        },
      }),
      prisma.reviewCard.upsert({
        where: { entryId: existingEntry.id },
        update: {
          due: updatedCardData.due,
          stability: updatedCardData.stability,
          difficulty: updatedCardData.difficulty,
          elapsedDays: updatedCardData.elapsedDays,
          scheduledDays: updatedCardData.scheduledDays,
          reps: updatedCardData.reps,
          lapses: updatedCardData.lapses,
          state: updatedCardData.state as CardState,
          lastReview: now,
        },
        create: {
          entryId: existingEntry.id,
          due: updatedCardData.due,
          stability: updatedCardData.stability,
          difficulty: updatedCardData.difficulty,
          elapsedDays: updatedCardData.elapsedDays,
          scheduledDays: updatedCardData.scheduledDays,
          reps: updatedCardData.reps,
          lapses: updatedCardData.lapses,
          state: updatedCardData.state as CardState,
          lastReview: now,
        },
      }),
    ]);

    revalidatePath("/today");
    revalidatePath("/problems");
    revalidatePath("/stats");
    return { success: true, entryId: updatedEntry.id, isNew: false };
  }

  // Create brand new Entry
  const initialCard = seedCard({
    entryId: "placeholder",
    status: data.status as SolveStatusType,
    revisit: data.revisit,
    now,
  });

  const rating = deriveRating({
    status: data.status as SolveStatusType,
    minutes: data.minutes,
    usedHint: data.status === "SOLVED_WITH_HELP",
    difficulty: problem.difficulty as ProblemDifficulty | null,
  });

  const result = await prisma.$transaction(async (tx) => {
    const entry = await tx.entry.create({
      data: {
        userId: user.id,
        problemId: targetProblemId!,
        status: data.status as SolveStatus,
        idea: data.idea,
        mistake: data.mistake,
        sourceList: data.sourceList,
        minutes: data.minutes,
        revisit: data.revisit,
        firstSolvedAt: now,
        patternOverride: data.patternOverride,
        topic: data.manualTopicTags[0] || data.patternOverride[0] || null,
      },
    });

    await tx.attempt.create({
      data: {
        entryId: entry.id,
        at: now,
        rating: rating as Rating,
        minutes: data.minutes,
        usedHint: data.status === "SOLVED_WITH_HELP",
        note: data.idea ? `Initial solve: ${data.idea.slice(0, 80)}` : null,
      },
    });

    const shouldSchedule = rating === "AGAIN" || rating === "HARD" || data.revisit === true;
    if (shouldSchedule) {
      await tx.reviewCard.create({
        data: {
          entryId: entry.id,
          due: initialCard.due,
          stability: initialCard.stability,
          difficulty: initialCard.difficulty,
          elapsedDays: initialCard.elapsedDays,
          scheduledDays: initialCard.scheduledDays,
          reps: initialCard.reps,
          lapses: initialCard.lapses,
          state: initialCard.state as CardState,
          lastReview: now,
        },
      });
    }

    return entry;
  });

  revalidatePath("/today");
  revalidatePath("/problems");
  revalidatePath("/stats");
  return { success: true, entryId: result.id, isNew: true };
}

const RecordReviewSchema = z.object({
  entryId: z.string().max(64),
  status: z.enum(["SOLVED_UNAIDED", "SOLVED_WITH_HELP", "ATTEMPTED_FAILED"]),
  minutes: z.number().int().min(0).max(1000).optional().nullable(),
  usedHint: z.boolean().default(false),
  note: z.string().max(LIMITS.note).optional().nullable(),
  newMistake: z.string().max(LIMITS.note).optional().nullable(),
});

export async function recordReviewAttempt(input: z.input<typeof RecordReviewSchema>) {
  const user = await getCurrentUser();
  const data = RecordReviewSchema.parse(input);

  const entry = await prisma.entry.findFirstOrThrow({
    where: { id: data.entryId, userId: user.id },
    include: { problem: true, reviewCard: true },
  });

  const userSettings = await prisma.userSettings.findUnique({
    where: { userId: user.id },
  });

  const baselines = userSettings
    ? {
        easy: userSettings.easyBaseline,
        medium: userSettings.mediumBaseline,
        hard: userSettings.hardBaseline,
      }
    : undefined;

  const rating = deriveRating({
    status: data.status as SolveStatusType,
    minutes: data.minutes,
    usedHint: data.usedHint || data.status === "SOLVED_WITH_HELP",
    difficulty: entry.problem.difficulty as ProblemDifficulty | null,
    baselines,
  });

  const now = new Date();

  const currentCard = entry.reviewCard
    ? {
        entryId: entry.id,
        due: entry.reviewCard.due,
        stability: entry.reviewCard.stability,
        difficulty: entry.reviewCard.difficulty,
        elapsedDays: entry.reviewCard.elapsedDays,
        scheduledDays: entry.reviewCard.scheduledDays,
        reps: entry.reviewCard.reps,
        lapses: entry.reviewCard.lapses,
        state: entry.reviewCard.state as any,
        lastReview: entry.reviewCard.lastReview,
      }
    : seedCard({
        entryId: entry.id,
        status: data.status as SolveStatusType,
        now,
      });

  const updatedCard = advanceCard({
    currentCard,
    rating,
    reviewDate: now,
    desiredRetention: userSettings?.desiredRetention ?? 0.80,
    fsrsParams: userSettings?.fsrsParams ?? [],
  });

  await prisma.$transaction([
    prisma.attempt.create({
      data: {
        entryId: entry.id,
        at: now,
        rating: rating as Rating,
        minutes: data.minutes,
        usedHint: data.usedHint || data.status === "SOLVED_WITH_HELP",
        note: data.note,
      },
    }),
    prisma.reviewCard.upsert({
      where: { entryId: entry.id },
      update: {
        due: updatedCard.due,
        stability: updatedCard.stability,
        difficulty: updatedCard.difficulty,
        elapsedDays: updatedCard.elapsedDays,
        scheduledDays: updatedCard.scheduledDays,
        reps: updatedCard.reps,
        lapses: updatedCard.lapses,
        state: updatedCard.state as CardState,
        lastReview: now,
      },
      create: {
        entryId: entry.id,
        due: updatedCard.due,
        stability: updatedCard.stability,
        difficulty: updatedCard.difficulty,
        elapsedDays: updatedCard.elapsedDays,
        scheduledDays: updatedCard.scheduledDays,
        reps: updatedCard.reps,
        lapses: updatedCard.lapses,
        state: updatedCard.state as CardState,
        lastReview: now,
      },
    }),
    ...(data.newMistake
      ? [
          prisma.entry.update({
            where: { id: entry.id },
            data: {
              mistake: entry.mistake ? `${entry.mistake}\n\n[Update ${now.toLocaleDateString()}]: ${data.newMistake}` : data.newMistake,
            },
          }),
        ]
      : []),
  ]);

  revalidatePath("/today");
  revalidatePath("/problems");
  revalidatePath("/stats");
  return { success: true, rating, nextDue: updatedCard.due };
}

const RecordRecallSchema = z.object({
  entryId: z.string().max(64),
  rating: z.enum(["AGAIN", "HARD", "GOOD"]),
  wroteApproach: z.string().max(LIMITS.note).optional().nullable(),
});

/**
 * Record a RECALL-lane review — no minutes, direct rating (Matched=GOOD, Close=HARD, Blank=AGAIN).
 */
export async function recordRecallAttempt(input: z.input<typeof RecordRecallSchema>) {
  const user = await getCurrentUser();
  const data = RecordRecallSchema.parse(input);

  const entry = await prisma.entry.findFirstOrThrow({
    where: { id: data.entryId, userId: user.id },
    include: { reviewCard: true },
  });

  const userSettings = await prisma.userSettings.findUnique({ where: { userId: user.id } });
  const now = new Date();

  const currentCard = entry.reviewCard
    ? {
        entryId: entry.id,
        due: entry.reviewCard.due,
        stability: entry.reviewCard.stability,
        difficulty: entry.reviewCard.difficulty,
        elapsedDays: entry.reviewCard.elapsedDays,
        scheduledDays: entry.reviewCard.scheduledDays,
        reps: entry.reviewCard.reps,
        lapses: entry.reviewCard.lapses,
        state: entry.reviewCard.state as any,
        lastReview: entry.reviewCard.lastReview,
      }
    : seedCard({ entryId: entry.id, status: "SOLVED_UNAIDED", now });

  const updatedCard = advanceCard({
    currentCard,
    rating: data.rating as AppRating,
    reviewDate: now,
    desiredRetention: userSettings?.desiredRetention ?? 0.80,
    fsrsParams: userSettings?.fsrsParams ?? [],
  });

  await prisma.$transaction([
    prisma.attempt.create({
      data: {
        entryId: entry.id,
        at: now,
        rating: data.rating as Rating,
        minutes: null,
        usedHint: false,
        note: data.wroteApproach ? `Recall: ${data.wroteApproach.slice(0, 120)}` : "Recall review",
      },
    }),
    prisma.reviewCard.upsert({
      where: { entryId: entry.id },
      update: {
        due: updatedCard.due,
        stability: updatedCard.stability,
        difficulty: updatedCard.difficulty,
        elapsedDays: updatedCard.elapsedDays,
        scheduledDays: updatedCard.scheduledDays,
        reps: updatedCard.reps,
        lapses: updatedCard.lapses,
        state: updatedCard.state as CardState,
        lastReview: now,
      },
      create: {
        entryId: entry.id,
        due: updatedCard.due,
        stability: updatedCard.stability,
        difficulty: updatedCard.difficulty,
        elapsedDays: updatedCard.elapsedDays,
        scheduledDays: updatedCard.scheduledDays,
        reps: updatedCard.reps,
        lapses: updatedCard.lapses,
        state: updatedCard.state as CardState,
        lastReview: now,
      },
    }),
  ]);

  revalidatePath("/today");
  revalidatePath("/problems");
  revalidatePath("/stats");
  return { success: true, rating: data.rating, nextDue: updatedCard.due };
}

const UpdateInlineSchema = z.discriminatedUnion("field", [
  z.object({ entryId: z.string().max(64), field: z.literal("idea"), value: z.string().max(LIMITS.note).nullable() }),
  z.object({ entryId: z.string().max(64), field: z.literal("mistake"), value: z.string().max(LIMITS.note).nullable() }),
  z.object({ entryId: z.string().max(64), field: z.literal("revisit"), value: z.boolean() }),
  z.object({
    entryId: z.string().max(64),
    field: z.literal("status"),
    value: z.enum(["SOLVED_UNAIDED", "SOLVED_WITH_HELP", "ATTEMPTED_FAILED"]),
  }),
]);

export async function updateEntryInline(params: z.input<typeof UpdateInlineSchema>) {
  const user = await getCurrentUser();
  const { entryId, field, value } = UpdateInlineSchema.parse(params);

  const result = await prisma.entry.updateMany({
    where: { id: entryId, userId: user.id },
    data: { [field]: value },
  });

  if (result.count === 0) {
    throw new Error("Entry not found");
  }

  revalidatePath("/problems");
  revalidatePath(`/problems/${entryId}`);
  return { success: true };
}

export async function toggleScheduleReview(entryId: string, schedule: boolean) {
  const user = await getCurrentUser();
  const id = z.string().max(64).parse(entryId);
  const entry = await prisma.entry.findFirstOrThrow({
    where: { id, userId: user.id },
    include: { reviewCard: true },
  });

  if (schedule) {
    if (!entry.reviewCard) {
      const now = new Date();
      const userSettings = await prisma.userSettings.findUnique({ where: { userId: user.id } });
      const initialCard = seedCard({
        entryId: entry.id,
        status: (entry.status as SolveStatusType) || "SOLVED_UNAIDED",
        revisit: entry.revisit,
        now,
        desiredRetention: userSettings?.desiredRetention ?? 0.80,
        fsrsParams: userSettings?.fsrsParams ?? [],
      });
      await prisma.reviewCard.create({
        data: {
          entryId: entry.id,
          due: initialCard.due,
          stability: initialCard.stability,
          difficulty: initialCard.difficulty,
          elapsedDays: initialCard.elapsedDays,
          scheduledDays: initialCard.scheduledDays,
          reps: initialCard.reps,
          lapses: initialCard.lapses,
          state: initialCard.state as CardState,
          lastReview: now,
        },
      });
    }
  } else {
    if (entry.reviewCard) {
      await prisma.reviewCard.delete({
        where: { entryId: entry.id },
      });
    }
  }

  revalidatePath("/today");
  revalidatePath("/problems");
  revalidatePath(`/problems/${entryId}`);
  return { success: true, scheduled: schedule };
}

export async function deleteEntry(entryId: string) {
  const user = await getCurrentUser();
  const id = z.string().max(64).parse(entryId);

  const deleted = await prisma.entry.deleteMany({
    where: { id, userId: user.id },
  });

  if (deleted.count === 0) {
    throw new Error("Entry not found or unauthorized");
  }

  revalidatePath("/today");
  revalidatePath("/problems");
  revalidatePath("/stats");
  revalidatePath("/roadmap");
  return { success: true };
}

export async function toggleRoadmapItemSolve(params: {
  canonicalProblemId?: string | null;
  itemTitle: string;
  itemPrimaryUrl?: string | null;
  currentlySolved: boolean;
  entryId?: string | null;
}) {
  const user = await getCurrentUser();
  const { canonicalProblemId, itemTitle, itemPrimaryUrl, currentlySolved, entryId } = z
    .object({
      canonicalProblemId: z.string().max(64).nullable().optional(),
      itemTitle: z.string().max(LIMITS.title),
      itemPrimaryUrl: z.string().max(LIMITS.url).nullable().optional(),
      currentlySolved: z.boolean(),
      entryId: z.string().max(64).nullable().optional(),
    })
    .parse(params);

  if (currentlySolved && entryId) {
    // Unmark / Deselect -> Delete the Entry (scoped to session user)
    const deleted = await prisma.entry.deleteMany({
      where: { id: entryId, userId: user.id },
    });
    if (deleted.count === 0) {
      throw new Error("Entry not found or unauthorized");
    }
    revalidatePath("/roadmap");
    revalidatePath("/today");
    revalidatePath("/problems");
    revalidatePath("/stats");
    return { success: true, solved: false, entryId: null };
  } else if (!currentlySolved) {
    // Select / Mark as solved
    let targetProblemId = canonicalProblemId;

    if (!targetProblemId) {
      const title = itemTitle || "Untitled Problem";
      const cleanSlug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

      const platform = itemPrimaryUrl?.includes("geeksforgeeks.org")
        ? Platform.GFG
        : itemPrimaryUrl?.includes("leetcode.com")
        ? Platform.LEETCODE
        : Platform.OTHER;

      const slug = `${cleanSlug}-${Date.now().toString(36)}`;
      const prob = await prisma.problem.create({
        data: {
          platform,
          slug,
          title,
          url: storedHttpUrl(itemPrimaryUrl) || "",
          topicTags: [],
        },
      });
      targetProblemId = prob.id;
    }

    const now = new Date();
    const seeded = seedCard({
      entryId: "placeholder",
      status: SolveStatus.SOLVED_UNAIDED,
      revisit: false,
      now,
    });

    const entry = await prisma.$transaction(async (tx) => {
      const created = await tx.entry.create({
        data: {
          userId: user.id,
          problemId: targetProblemId,
          status: SolveStatus.SOLVED_UNAIDED,
          firstSolvedAt: now,
          sourceList: "Roadmap Check",
        },
      });

      await tx.reviewCard.create({
        data: {
          entryId: created.id,
          due: seeded.due,
          stability: seeded.stability,
          difficulty: seeded.difficulty,
          elapsedDays: seeded.elapsedDays,
          scheduledDays: seeded.scheduledDays,
          reps: seeded.reps,
          lapses: seeded.lapses,
          state: seeded.state as CardState,
          lastReview: now,
        },
      });

      return created;
    });

    revalidatePath("/roadmap");
    revalidatePath("/today");
    revalidatePath("/problems");
    revalidatePath("/stats");
    return { success: true, solved: true, entryId: entry.id };
  }

  return { success: true };
}

