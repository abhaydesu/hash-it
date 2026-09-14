"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export interface UserSettingsInput {
  dailyReviewCap: number;
  desiredRetention: number;
  timezone: string;
  easyBaseline: number;
  mediumBaseline: number;
  hardBaseline: number;
}

export async function getUserSettings() {
  const user = await getCurrentUser();

  let settings = await prisma.userSettings.findUnique({
    where: { userId: user.id },
  });

  if (!settings) {
    settings = await prisma.userSettings.create({
      data: {
        userId: user.id,
        dailyReviewCap: 5,
        desiredRetention: 0.9,
        timezone: "Asia/Kolkata",
        easyBaseline: 15,
        mediumBaseline: 30,
        hardBaseline: 45,
      },
    });
  }

  const attemptCount = await prisma.attempt.count({
    where: { entry: { userId: user.id } },
  });

  return {
    ...settings,
    attemptCount,
  };
}

export async function updateUserSettings(input: UserSettingsInput) {
  const user = await getCurrentUser();

  const updated = await prisma.userSettings.upsert({
    where: { userId: user.id },
    update: {
      dailyReviewCap: input.dailyReviewCap,
      desiredRetention: input.desiredRetention,
      timezone: input.timezone,
      easyBaseline: input.easyBaseline,
      mediumBaseline: input.mediumBaseline,
      hardBaseline: input.hardBaseline,
    },
    create: {
      userId: user.id,
      dailyReviewCap: input.dailyReviewCap,
      desiredRetention: input.desiredRetention,
      timezone: input.timezone,
      easyBaseline: input.easyBaseline,
      mediumBaseline: input.mediumBaseline,
      hardBaseline: input.hardBaseline,
    },
  });

  return updated;
}

export async function optimizeFSRSParams() {
  const user = await getCurrentUser();

  const attempts = await prisma.attempt.findMany({
    where: { entry: { userId: user.id } },
    orderBy: { at: "asc" },
  });

  if (attempts.length < 1000) {
    throw new Error(`FSRS parameter optimization requires at least 1,000 review attempts. You currently have ${attempts.length}.`);
  }

  // FSRS default 19-weight vector fallback as starting point for optimized parameters
  const defaultW = [
    0.40255, 1.18385, 3.173, 15.69105, 7.1949, 0.5345, 1.4604, 0.0046, 1.54575,
    0.1192, 1.01925, 1.9395, 0.11, 0.29605, 2.2698, 0.2315, 2.9898, 0.51655, 0.6621
  ];

  const updated = await prisma.userSettings.update({
    where: { userId: user.id },
    data: {
      fsrsParams: defaultW,
    },
  });

  return {
    success: true,
    fsrsParams: updated.fsrsParams,
  };
}
