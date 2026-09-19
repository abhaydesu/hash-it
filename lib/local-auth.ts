import { prisma } from "@/lib/prisma";

export async function findOrCreateLocalUser(emailInput?: string | null, nameInput?: string | null) {
  const rawEmail = (emailInput ?? "").trim().toLowerCase();
  const email = rawEmail || "dev-user-local@example.com";
  const name = (nameInput ?? email.split("@")[0] ?? "Local Dev").trim() || "Local Dev";

  const user = await prisma.user.upsert({
    where: { email },
    update: { name },
    create: { email, name },
  });

  await prisma.userSettings.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      dailyResolveCap: 2,
      desiredRetention: 0.8,
      fsrsParams: [],
      timezone: "Asia/Kolkata",
      easyBaseline: 20,
      mediumBaseline: 40,
      hardBaseline: 60,
    },
  });

  return user;
}
