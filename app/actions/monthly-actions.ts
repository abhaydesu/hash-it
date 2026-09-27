"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { recordMonthlyMock } from "@/lib/monthly-mock";

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
