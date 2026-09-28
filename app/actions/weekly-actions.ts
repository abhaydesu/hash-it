"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { startOfTomorrow } from "@/lib/dates";
import { weeklyWindow } from "@/lib/review-windows";
import { checkOutcome, PLAN_KINDS } from "@/lib/weekly-review";

const CheckSchema = z.object({
  entryId: z.string().min(1),
  confidence: z.enum(["BLANK", "HAZY", "CLEAR"]),
  recalled: z.boolean(),
});

async function userTimezone(userId: string) {
  const s = await prisma.userSettings.findUnique({ where: { userId }, select: { timezone: true } });
  return s?.timezone || "Asia/Kolkata";
}

/** The week being reviewed, or an error outside the Sunday/Monday window. */
function openPlanWeek(now: Date, timezone: string) {
  const window = weeklyWindow(now, timezone);
  if (!window.open) throw new Error("The weekly review opens on Sunday.");
  return window.planWeek;
}

/**
 * Record one recall-check answer. A miss makes the card due tomorrow — only ever
 * earlier, and only the due date: stability is left to FSRS.
 */
export async function recordRecallCheck(input: z.infer<typeof CheckSchema>) {
  const user = await getCurrentUser();
  const data = CheckSchema.parse(input);
  const now = new Date();
  const timezone = await userTimezone(user.id);

  const card = await prisma.reviewCard.findFirst({
    where: { entryId: data.entryId, entry: { userId: user.id } },
    select: { due: true },
  });
  if (!card) throw new Error("Problem not found.");

  const week = openPlanWeek(now, timezone);
  const outcome = checkOutcome(data.confidence, data.recalled);
  const tomorrow = startOfTomorrow(now, timezone);

  await prisma.$transaction([
    prisma.weeklyCheck.upsert({
      where: { entryId_weekStart: { entryId: data.entryId, weekStart: week } },
      update: { confidence: data.confidence, recalled: data.recalled, at: now },
      create: { userId: user.id, entryId: data.entryId, weekStart: week, confidence: data.confidence, recalled: data.recalled },
    }),
    ...(outcome.dueTomorrow && card.due > tomorrow
      ? [prisma.reviewCard.update({ where: { entryId: data.entryId }, data: { due: tomorrow } })]
      : []),
  ]);

  revalidatePath("/today");
  return outcome;
}

const PlanSchema = z.object({
  items: z
    .array(z.object({ kind: z.enum(PLAN_KINDS as [string, ...string[]]), problemId: z.string().min(1) }))
    .max(PLAN_KINDS.length)
    .refine((items) => new Set(items.map((i) => i.kind)).size === items.length, "One problem per kind."),
});

/** Save (or replace) the plan for the week under review. */
export async function commitWeeklyPlan(input: z.infer<typeof PlanSchema>) {
  const user = await getCurrentUser();
  const { items } = PlanSchema.parse(input);
  const now = new Date();
  const week = openPlanWeek(now, await userTimezone(user.id));

  // REDO / REVISIT must be the user's own problems; FRESH just has to exist.
  const [owned, existing] = await Promise.all([
    prisma.entry.findMany({
      where: { userId: user.id, problemId: { in: items.map((i) => i.problemId) } },
      select: { problemId: true },
    }),
    prisma.problem.findMany({ where: { id: { in: items.map((i) => i.problemId) } }, select: { id: true } }),
  ]);
  const ownedIds = new Set(owned.map((e) => e.problemId));
  const existingIds = new Set(existing.map((p) => p.id));
  for (const i of items) {
    if (!existingIds.has(i.problemId) || (i.kind !== "FRESH" && !ownedIds.has(i.problemId))) {
      throw new Error("One of the chosen problems isn't available.");
    }
  }

  await prisma.$transaction(async (tx) => {
    const plan = await tx.weeklyPlan.upsert({
      where: { userId_weekStart: { userId: user.id, weekStart: week } },
      // Keep the original start so items already finished this week stay done after an edit.
      update: {},
      create: { userId: user.id, weekStart: week, createdAt: now },
      select: { id: true },
    });
    await tx.weeklyPlanItem.deleteMany({ where: { planId: plan.id } });
    await tx.weeklyPlanItem.createMany({
      data: items.map((i) => ({ planId: plan.id, kind: i.kind as (typeof PLAN_KINDS)[number], problemId: i.problemId })),
    });
  });

  revalidatePath("/today");
  revalidatePath("/review/weekly");
}
