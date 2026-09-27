import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { StatsClient } from "@/components/stats-client";
import { computeAllStats } from "@/lib/stats-engine";
import { readStatsPreferences } from "@/lib/stats-preferences";

export const dynamic = "force-dynamic";

// Loading UI lives in ./loading.tsx.
export default async function StatsPage() {
  const user = await getCurrentUser();

  const [allStats, settings] = await Promise.all([
    computeAllStats(user.id),
    prisma.userSettings.findUnique({ where: { userId: user.id }, select: { statsPreferences: true } }),
  ]);

  return <StatsClient allStats={allStats} preferences={readStatsPreferences(settings?.statsPreferences)} />;
}
