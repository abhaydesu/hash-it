"use server";

import { z } from "zod";
import { revalidatePath, revalidateTag } from "next/cache";
import { CATALOG_CACHE_TAG } from "@/lib/practice";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { addDays, localDay, startOfLocalDay } from "@/lib/dates";
import { DEFAULT_TIMEZONE, getUserSettingsRow } from "@/lib/user-settings";
import { baselinesFrom, cardColumns, scheduleSettings, toCardData } from "@/lib/review-card";
import {
  seedCard,
  advanceCard,
  deriveRating,
  firstIntervalsFrom,
  type SolveStatusType,
  type ProblemDifficulty,
  type AppRating,
} from "@/lib/scheduler";
import { Platform, Difficulty, SolveStatus, Rating } from "@prisma/client";
import { LIMITS, storedHttpUrl } from "@/lib/safe";
import { parseSlugFromUrl } from "@/lib/problem-url";
import { readCustomFieldDefs, sanitizeCustomValues, mergeSelectOptions, SYSTEM_SOURCES } from "@/lib/custom-fields";
import type { Prisma } from "@prisma/client";

const CustomValuesInput = z
  .record(z.string().max(40), z.union([z.string().max(2000), z.number(), z.boolean(), z.null()]))
  .optional();

/** Validate submitted custom values against the user's current field definitions. */
async function resolveCustomValues(userId: string, raw: unknown) {
  if (!raw) return null;
  const settings = await prisma.userSettings.findUnique({
    where: { userId },
    select: { customFields: true },
  });
  const defs = readCustomFieldDefs(settings?.customFields);
  if (defs.length === 0) return null;
  // Explicitly blanked fields (null / "") are removed on merge.
  const cleared = Object.entries(raw as Record<string, unknown>)
    .filter(([id, v]) => (v === null || v === "") && defs.some((d) => d.id === id))
    .map(([id]) => id);
  return { values: sanitizeCustomValues(defs, raw), cleared };
}

function mergeCustomValues(
  existing: unknown,
  update: { values: Record<string, unknown>; cleared: string[] } | null
): Prisma.InputJsonObject | undefined {
  if (!update) return undefined;
  const base = { ...((existing as Record<string, unknown> | null) ?? {}) };
  for (const id of update.cleared) delete base[id];
  return { ...base, ...update.values } as Prisma.InputJsonObject;
}

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
  customValues: CustomValuesInput,
});

export async function createEntry(input: z.input<typeof CreateEntrySchema>) {
  const user = await getCurrentUser();
  const data = CreateEntrySchema.parse(input);
  const custom = await resolveCustomValues(user.id, data.customValues);

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
    revalidateTag(CATALOG_CACHE_TAG);
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
    include: { reviewCard: true, attempts: { orderBy: { at: "desc" }, take: 1, select: { rating: true } } },
  });

  const now = new Date();

  if (existingEntry) {
    // Spec §3: Re-solving a problem never creates a second Entry. It appends an Attempt and advances ReviewCard.
    const userSettings = await getUserSettingsRow(user.id);

    const baselines = baselinesFrom(userSettings);

    const rating = deriveRating({
      status: data.status as SolveStatusType,
      minutes: data.minutes,
      usedHint: data.status === "SOLVED_WITH_HELP",
      difficulty: problem.difficulty as ProblemDifficulty | null,
      baselines,
      firstSolve: !existingEntry.reviewCard && existingEntry.attempts.length === 0,
      previousRating: (existingEntry.attempts[0]?.rating ?? null) as AppRating | null,
    });

    let updatedCardData;
    if (existingEntry.reviewCard) {
      updatedCardData = advanceCard({
        currentCard: toCardData(existingEntry.reviewCard),
        rating,
        reviewDate: now,
        ...scheduleSettings(userSettings),
      });
    } else {
      updatedCardData = seedCard({
        entryId: existingEntry.id,
        rating,
        now,
        ...scheduleSettings(userSettings),
        flagged: data.revisit,
        intervals: firstIntervalsFrom(userSettings),
      });
    }

    if (existingEntry.reviewCard && data.revisit && !existingEntry.revisit) {
      const flaggedDays = firstIntervalsFrom(userSettings).flagged;
      const sooner = new Date(now.getTime() + flaggedDays * 86_400_000);
      if (updatedCardData.due > sooner) {
        updatedCardData.due = sooner;
        updatedCardData.scheduledDays = flaggedDays;
      }
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
          customValues: mergeCustomValues(existingEntry.customValues, custom),
          sourceList: data.sourceList ?? existingEntry.sourceList,
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
          source: "LOG",
        },
      }),
      prisma.reviewCard.upsert({
        where: { entryId: existingEntry.id },
        update: {
          ...cardColumns(updatedCardData, now),
        },
        create: {
          entryId: existingEntry.id,
          ...cardColumns(updatedCardData, now),
        },
      }),
    ]);

    revalidatePath("/today");
    revalidatePath("/problems");
    revalidatePath("/stats");
    revalidatePath("/review/weekly");
    return { success: true, entryId: updatedEntry.id, isNew: false };
  }

  // Create brand new Entry
  const newEntrySettings = await getUserSettingsRow(user.id);

  const rating = deriveRating({
    status: data.status as SolveStatusType,
    minutes: data.minutes,
    usedHint: data.status === "SOLVED_WITH_HELP",
    difficulty: problem.difficulty as ProblemDifficulty | null,
    firstSolve: true,
    baselines: baselinesFrom(newEntrySettings),
  });

  const initialCard = seedCard({
    entryId: "placeholder",
    rating,
    now,
    ...scheduleSettings(newEntrySettings),
    flagged: data.revisit,
    intervals: firstIntervalsFrom(newEntrySettings),
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
        customValues: mergeCustomValues(null, custom),
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
        source: "LOG",
      },
    });

    // Every logged problem enters the rotation — FSRS decides how far out the
    // first review lands, so a confident solve is spaced, never dropped.
    await tx.reviewCard.create({
      data: {
        entryId: entry.id,
        ...cardColumns(initialCard, now),
      },
    });

    return entry;
  });

  revalidatePath("/today");
  revalidatePath("/problems");
  revalidatePath("/stats");
  revalidatePath("/review/weekly");
  return { success: true, entryId: result.id, isNew: true };
}

const RecordReviewSchema = z.object({
  entryId: z.string().max(64),
  status: z.enum(["SOLVED_UNAIDED", "SOLVED_WITH_HELP", "ATTEMPTED_FAILED"]),
  minutes: z.number().int().min(0).max(1000).optional().nullable(),
  usedHint: z.boolean().default(false),
  note: z.string().max(LIMITS.note).optional().nullable(),
  newMistake: z.string().max(LIMITS.note).optional().nullable(),
  /** Set when logged from the Today queue, so it counts against the daily cap. */
  fromQueue: z.boolean().default(false),
});

export async function recordReviewAttempt(input: z.input<typeof RecordReviewSchema>) {
  const user = await getCurrentUser();
  const data = RecordReviewSchema.parse(input);

  const entry = await prisma.entry.findFirstOrThrow({
    where: { id: data.entryId, userId: user.id },
    include: {
      problem: true,
      reviewCard: true,
      attempts: { orderBy: { at: "desc" }, take: 1, select: { rating: true } },
    },
  });

  const userSettings = await getUserSettingsRow(user.id);

  const baselines = baselinesFrom(userSettings);

  const rating = deriveRating({
    status: data.status as SolveStatusType,
    minutes: data.minutes,
    usedHint: data.usedHint || data.status === "SOLVED_WITH_HELP",
    difficulty: entry.problem.difficulty as ProblemDifficulty | null,
    baselines,
    firstSolve: !entry.reviewCard && entry.attempts.length === 0,
    previousRating: (entry.attempts[0]?.rating ?? null) as AppRating | null,
  });

  const now = new Date();

  // This attempt advances the existing card; with no card yet it *is* the first
  // review, so it seeds one — applying the rating once, not twice.
  const schedule = scheduleSettings(userSettings);
  const updatedCard = entry.reviewCard
    ? advanceCard({
        currentCard: toCardData(entry.reviewCard),
        rating,
        reviewDate: now,
        ...schedule,
      })
    : seedCard({ entryId: entry.id, rating, now, ...schedule, intervals: firstIntervalsFrom(userSettings) });

  await prisma.$transaction([
    prisma.attempt.create({
      data: {
        entryId: entry.id,
        at: now,
        rating: rating as Rating,
        minutes: data.minutes,
        usedHint: data.usedHint || data.status === "SOLVED_WITH_HELP",
        note: data.note,
        lane: data.fromQueue ? "RESOLVE" : null,
        source: data.fromQueue ? "REVIEW" : "LOG",
      },
    }),
    prisma.reviewCard.upsert({
      where: { entryId: entry.id },
      update: {
        ...cardColumns(updatedCard, now),
      },
      create: {
        entryId: entry.id,
        ...cardColumns(updatedCard, now),
      },
    }),
    ...(data.newMistake
      ? [
          prisma.entry.update({
            where: { id: entry.id },
            data: {
              mistake: entry.mistake ? `${entry.mistake}\n\n[Update ${now.toLocaleDateString()}]: ${data.newMistake}` : data.newMistake,
              ...(data.status === "SOLVED_UNAIDED" ? { revisit: false } : {}),
            },
          }),
        ]
      : data.status === "SOLVED_UNAIDED"
        ? [prisma.entry.update({ where: { id: entry.id }, data: { revisit: false } })]
        : []),
  ]);

  revalidatePath("/today");
  revalidatePath("/problems");
  revalidatePath("/stats");
  revalidatePath("/review/weekly");
  return { success: true, rating, nextDue: updatedCard.due };
}

const RecordRecallSchema = z.object({
  entryId: z.string().max(64),
  rating: z.enum(["AGAIN", "HARD", "GOOD"]),
  wroteApproach: z.string().max(LIMITS.note).optional().nullable(),
  retryTomorrow: z.boolean().default(false),
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

  const userSettings = await getUserSettingsRow(user.id);
  const now = new Date();

  // This attempt advances the existing card; with no card yet it *is* the first
  // review, so it seeds one — applying the rating once, not twice.
  const schedule = scheduleSettings(userSettings);
  const updatedCard = entry.reviewCard
    ? advanceCard({
        currentCard: toCardData(entry.reviewCard),
        rating: data.rating as AppRating,
        reviewDate: now,
        ...schedule,
      })
    : seedCard({ entryId: entry.id, rating: data.rating as AppRating, now, ...schedule, intervals: firstIntervalsFrom(userSettings) });

  // A blank answer on an overdue quick-recall card returns it to full solve tomorrow.
  if (data.retryTomorrow && data.rating === "AGAIN") {
    const timezone = userSettings?.timezone ?? DEFAULT_TIMEZONE;
    const tomorrow = startOfLocalDay(addDays(localDay(now, timezone), 1), timezone);
    updatedCard.due = tomorrow;
    updatedCard.scheduledDays = 1;
  }

  await prisma.$transaction([
    prisma.attempt.create({
      data: {
        entryId: entry.id,
        at: now,
        rating: data.rating as Rating,
        minutes: null,
        usedHint: false,
        note: data.wroteApproach ? `Recall: ${data.wroteApproach.slice(0, 120)}` : "Recall review",
        lane: "RECALL",
        source: "REVIEW",
      },
    }),
    prisma.reviewCard.upsert({
      where: { entryId: entry.id },
      update: {
        ...cardColumns(updatedCard, now),
      },
      create: {
        entryId: entry.id,
        ...cardColumns(updatedCard, now),
      },
    }),
  ]);

  revalidatePath("/today");
  revalidatePath("/problems");
  revalidatePath("/stats");
  revalidatePath("/review/weekly");
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
  z.object({ entryId: z.string().max(64), field: z.literal("patternOverride"), value: z.array(z.string().max(120)).max(10) }),
  z.object({ entryId: z.string().max(64), field: z.literal("minutes"), value: z.number().int().min(0).max(9999).nullable() }),
]);

export async function updateEntryInline(params: z.input<typeof UpdateInlineSchema>) {
  const user = await getCurrentUser();
  const { entryId, field, value } = UpdateInlineSchema.parse(params);

  const data: Record<string, unknown> = { [field]: value };
  if (field === "patternOverride") {
    const patterns = value as string[];
    data.customPattern = patterns[0] ?? null;
  }

  const result = await prisma.entry.updateMany({
    where: { id: entryId, userId: user.id },
    data,
  });

  if (result.count === 0) {
    throw new Error("Entry not found");
  }

  // Flagging pulls a card in to the flagged first interval. It never pushes a due date out.
  if (field === "revisit" && value === true) {
    const now = new Date();
    const card = await prisma.reviewCard.findFirst({
      where: { entryId, entry: { userId: user.id } },
      select: { due: true },
    });
    const flaggedDays = firstIntervalsFrom(await getUserSettingsRow(user.id)).flagged;
    const sooner = new Date(now.getTime() + flaggedDays * 86_400_000);
    if (card && card.due > sooner) {
      await prisma.reviewCard.update({
        where: { entryId },
        data: { due: sooner, scheduledDays: flaggedDays },
      });
      revalidatePath("/today");
    }
  }

  revalidatePath("/problems");
  revalidatePath(`/problems/${entryId}`);
  return { success: true };
}

/** Set or clear custom field values on one entry (problem page editor). */
export async function updateEntryCustomValues(entryId: string, values: z.input<typeof CustomValuesInput>) {
  const user = await getCurrentUser();
  const id = z.string().max(64).parse(entryId);
  const parsed = CustomValuesInput.parse(values);
  const entry = await prisma.entry.findFirst({
    where: { id, userId: user.id },
    select: { id: true, customValues: true },
  });
  if (!entry) throw new Error("Entry not found");

  const custom = await resolveCustomValues(user.id, parsed);
  const next = mergeCustomValues(entry.customValues, custom);
  if (next) {
    await prisma.entry.update({ where: { id: entry.id }, data: { customValues: next } });
  }

  // Persist new select options to the field definitions
  if (parsed && typeof parsed === "object") {
    const settings = await prisma.userSettings.findUnique({
      where: { userId: user.id },
      select: { customFields: true },
    });
    const defs = readCustomFieldDefs(settings?.customFields);
    let defsChanged = false;
    const updatedDefs = defs.map((def) => {
      if (def.type !== "select") return def;
      const val = (parsed as Record<string, unknown>)[def.id];
      if (typeof val !== "string" || !val.trim()) return def;
      if (def.options?.some((o) => o.toLowerCase() === val.trim().toLowerCase())) return def;
      defsChanged = true;
      return mergeSelectOptions(def, [val.trim()]);
    });
    if (defsChanged) {
      await prisma.userSettings.update({
        where: { userId: user.id },
        data: { customFields: updatedDefs as any },
      });
    }
  }

  revalidatePath("/problems");
  revalidatePath(`/problems/${id}`);
  return { success: true, customValues: next ?? {} };
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
      const userSettings = await getUserSettingsRow(user.id);
      const initialCard = seedCard({
        entryId: entry.id,
        rating: deriveRating({
          status: (entry.status as SolveStatusType) || "SOLVED_UNAIDED",
          minutes: entry.minutes,
          firstSolve: true,
        }),
        now,
        ...scheduleSettings(userSettings),
        flagged: entry.revisit,
        intervals: firstIntervalsFrom(userSettings),
      });
      await prisma.reviewCard.create({
        data: {
          entryId: entry.id,
          ...cardColumns(initialCard, now),
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
    const seeded = seedCard({ entryId: "placeholder", rating: "GOOD", now });

    const entry = await prisma.$transaction(async (tx) => {
      const created = await tx.entry.create({
        data: {
          userId: user.id,
          problemId: targetProblemId,
          status: SolveStatus.SOLVED_UNAIDED,
          firstSolvedAt: now,
          sourceList: SYSTEM_SOURCES.roadmap,
        },
      });

      await tx.reviewCard.create({
        data: {
          entryId: created.id,
          ...cardColumns(seeded, now),
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
