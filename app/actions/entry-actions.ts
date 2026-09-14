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

const CreateEntrySchema = z.object({
  problemId: z.string().optional(),
  // For manual problem creation if problemId is omitted:
  manualTitle: z.string().optional(),
  manualUrl: z.string().optional(),
  manualPlatform: z.enum(["LEETCODE", "GFG", "OTHER"]).default("OTHER"),
  manualDifficulty: z.enum(["EASY", "MEDIUM", "HARD"]).optional(),
  manualTopicTags: z.array(z.string()).default([]),

  status: z.enum(["SOLVED_UNAIDED", "SOLVED_WITH_HELP", "ATTEMPTED_FAILED"]),
  minutes: z.number().int().min(0).max(1000).optional().nullable(),
  idea: z.string().optional().nullable(),
  mistake: z.string().optional().nullable(),
  sourceList: z.string().optional().nullable(),
  revisit: z.boolean().default(false),
  patternOverride: z.array(z.string()).default([]),
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
    if (data.manualUrl) {
      try {
        const parts = new URL(data.manualUrl).pathname.split("/").filter(Boolean);
        if (parts.length > 0) slug = parts[parts.length - 1];
      } catch {
        // use derived slug
      }
    }

    const newProblem = await prisma.problem.create({
      data: {
        platform: data.manualPlatform as Platform,
        slug: slug || `problem-${Date.now()}`,
        title,
        url: data.manualUrl || "",
        difficulty: data.manualDifficulty as Difficulty | null,
        topicTags: data.manualTopicTags,
      },
    });
    targetProblemId = newProblem.id;
  }

  // Look up problem to get difficulty for baselines
  const problem = await prisma.problem.findUniqueOrThrow({
    where: { id: targetProblemId },
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
        desiredRetention: userSettings?.desiredRetention ?? 0.85,
        fsrsParams: userSettings?.fsrsParams ?? [],
      });
    } else {
      updatedCardData = seedCard({
        entryId: existingEntry.id,
        status: data.status as SolveStatusType,
        revisit: data.revisit,
        now,
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
    baselines: {
      easy: problem.difficulty === "EASY" ? 15 : 15,
      medium: problem.difficulty === "MEDIUM" ? 30 : 30,
      hard: problem.difficulty === "HARD" ? 45 : 45,
    },
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

    return entry;
  });

  revalidatePath("/today");
  revalidatePath("/problems");
  revalidatePath("/stats");
  return { success: true, entryId: result.id, isNew: true };
}

const RecordReviewSchema = z.object({
  entryId: z.string(),
  status: z.enum(["SOLVED_UNAIDED", "SOLVED_WITH_HELP", "ATTEMPTED_FAILED"]),
  minutes: z.number().int().min(0).max(1000).optional().nullable(),
  usedHint: z.boolean().default(false),
  note: z.string().optional().nullable(),
  newMistake: z.string().optional().nullable(),
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
    desiredRetention: userSettings?.desiredRetention ?? 0.9,
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

export async function updateEntryInline(params: {
  entryId: string;
  field: "idea" | "mistake" | "revisit" | "status";
  value: any;
}) {
  const user = await getCurrentUser();
  const { entryId, field, value } = params;

  await prisma.entry.findFirstOrThrow({
    where: { id: entryId, userId: user.id },
  });

  await prisma.entry.update({
    where: { id: entryId },
    data: {
      [field]: value,
    },
  });

  revalidatePath("/problems");
  revalidatePath(`/problems/${entryId}`);
  return { success: true };
}

export async function deleteEntry(entryId: string) {
  const user = await getCurrentUser();

  await prisma.entry.deleteMany({
    where: { id: entryId, userId: user.id },
  });

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
  const { canonicalProblemId, itemTitle, itemPrimaryUrl, currentlySolved, entryId } = params;

  if (currentlySolved && entryId) {
    // Unmark / Deselect -> Delete the Entry
    await prisma.entry.deleteMany({
      where: { id: entryId, userId: user.id },
    });
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

      const prob = await prisma.problem.create({
        data: {
          platform,
          slug: `${cleanSlug}-${Date.now().toString(36)}`,
          title,
          url: itemPrimaryUrl || "#",
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

    const entry = await prisma.entry.create({
      data: {
        userId: user.id,
        problemId: targetProblemId,
        status: SolveStatus.SOLVED_UNAIDED,
        firstSolvedAt: now,
        sourceList: "Roadmap Check",
      },
    });

    await prisma.reviewCard.create({
      data: {
        entryId: entry.id,
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

    revalidatePath("/roadmap");
    revalidatePath("/today");
    revalidatePath("/problems");
    revalidatePath("/stats");
    return { success: true, solved: true, entryId: entry.id };
  }

  return { success: true };
}

