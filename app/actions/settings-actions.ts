"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

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
        easyBaseline: 15,
        mediumBaseline: 30,
        hardBaseline: 45,
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
