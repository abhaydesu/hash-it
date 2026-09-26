"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import {
  CustomFieldDefSchema,
  MAX_CUSTOM_FIELDS,
  readCustomFieldDefs,
  type CustomFieldDef,
} from "@/lib/custom-fields";

const SettingsSchema = z.object({
  dailyResolveCap: z.number().int().min(1).max(50),
  desiredRetention: z.number().min(0.7).max(0.95),
  timezone: z.string().min(1).max(64),
  easyBaseline: z.number().int().min(1).max(600),
  mediumBaseline: z.number().int().min(1).max(600),
  hardBaseline: z.number().int().min(1).max(600),
});

export type UserSettingsInput = z.infer<typeof SettingsSchema>;

export async function getUserSettings() {
  const user = await getCurrentUser();

  const [settings, attemptCount] = await Promise.all([
    prisma.userSettings.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        dailyResolveCap: 2,
        desiredRetention: 0.8,
        timezone: "Asia/Kolkata",
        easyBaseline: 20,
        mediumBaseline: 40,
        hardBaseline: 60,
      },
    }),
    prisma.attempt.count({
      where: { entry: { userId: user.id } },
    }),
  ]);

  return {
    ...settings,
    attemptCount,
  };
}

export async function updateUserSettings(input: UserSettingsInput) {
  const user = await getCurrentUser();
  const data = SettingsSchema.parse(input);

  return prisma.userSettings.upsert({
    where: { userId: user.id },
    update: data,
    create: { userId: user.id, ...data },
  });
}

export async function optimizeFSRSParams() {
  const user = await getCurrentUser();

  const attemptCount = await prisma.attempt.count({
    where: { entry: { userId: user.id } },
  });

  if (attemptCount < 1000) {
    throw new Error(
      `FSRS parameter optimization requires at least 1,000 review attempts. You currently have ${attemptCount}.`
    );
  }

  const defaultW = [
    0.40255, 1.18385, 3.173, 15.69105, 7.1949, 0.5345, 1.4604, 0.0046, 1.54575,
    0.1192, 1.01925, 1.9395, 0.11, 0.29605, 2.2698, 0.2315, 2.9898, 0.51655, 0.6621,
  ];

  const updated = await prisma.userSettings.update({
    where: { userId: user.id },
    data: { fsrsParams: defaultW },
  });

  return {
    success: true,
    fsrsParams: updated.fsrsParams,
  };
}

/** The signed-in user's custom field definitions, in display order. */
export async function getCustomFields(): Promise<CustomFieldDef[]> {
  const user = await getCurrentUser();
  const settings = await prisma.userSettings.findUnique({
    where: { userId: user.id },
    select: { customFields: true },
  });
  return readCustomFieldDefs(settings?.customFields);
}

/**
 * Replace the definitions (rename, reorder, edit options, delete, add).
 * Ids are the join key into Entry.customValues, so an id's type can't change:
 * values stored under it would no longer match. Deleting a field leaves its
 * stored values in place, unreferenced, so re-adding the same id restores them.
 */
export async function saveCustomFields(input: CustomFieldDef[]): Promise<CustomFieldDef[]> {
  const user = await getCurrentUser();
  const next = z.array(CustomFieldDefSchema).max(MAX_CUSTOM_FIELDS).parse(input);
  if (new Set(next.map((f) => f.id)).size !== next.length) {
    throw new Error("Duplicate field ids.");
  }
  const current = await getCustomFields();
  for (const f of next) {
    const prev = current.find((c) => c.id === f.id);
    if (prev && prev.type !== f.type) {
      throw new Error(`"${prev.label}" is a ${prev.type} field; its type can't be changed.`);
    }
  }
  await prisma.userSettings.upsert({
    where: { userId: user.id },
    update: { customFields: next },
    create: { userId: user.id, customFields: next },
  });
  revalidatePath("/settings");
  revalidatePath("/problems");
  return next;
}
