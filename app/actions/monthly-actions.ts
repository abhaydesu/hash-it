"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { recordMonthlyMock } from "@/lib/monthly-mock";
import { prisma } from "@/lib/prisma";
import { LIMITS } from "@/lib/safe";

const ResultSchema = z.object({
  sessionId: z.string().min(1).max(100),
  solved: z.number().int().min(0).max(20),
  hinted: z.number().int().min(0).max(20),
  failed: z.number().int().min(0).max(20),
  durationSec: z.number().int().min(0).max(7 * 86_400),
});

/** Called once when a mock session finishes. Returns the month it counted for. */
export async function completeMonthlyMock(input: z.infer<typeof ResultSchema>) {
  const user = await getCurrentUser();
  const mock = await recordMonthlyMock(user.id, ResultSchema.parse(input));
  revalidatePath("/review/monthly");
  revalidatePath("/today");
  return { period: mock.period };
}

const NotesSchema = z
  .array(
    z.object({
      entryId: z.string().min(1).max(64),
      idea: z.string().max(LIMITS.note).nullable().optional(),
      mistake: z.string().max(LIMITS.note).nullable().optional(),
    }),
  )
  .max(10);

/** Wrap-up step: save idea/mistake notes for the mock's problems in one go. */
export async function saveMonthlyMockNotes(input: z.input<typeof NotesSchema>) {
  const user = await getCurrentUser();
  const notes = NotesSchema.parse(input).filter((n) => n.idea !== undefined || n.mistake !== undefined);
  if (notes.length === 0) return { saved: 0 };

  const clean = (v: string | null | undefined) => (v === undefined ? undefined : v?.trim() || null);
  const results = await prisma.$transaction(
    notes.map((n) =>
      prisma.entry.updateMany({
        where: { id: n.entryId, userId: user.id },
        data: { idea: clean(n.idea), mistake: clean(n.mistake) },
      }),
    ),
  );
  revalidatePath("/problems");
  for (const n of notes) revalidatePath(`/problems/${n.entryId}`);
  return { saved: results.reduce((s, r) => s + r.count, 0) };
}
