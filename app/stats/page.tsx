import { getCurrentUser } from "@/lib/auth";
import { getUserSettingsRow } from "@/lib/user-settings";
import { StatsClient } from "@/components/stats-client";
import { computeAllStats } from "@/lib/stats-engine";
import { readStatsPreferences } from "@/lib/stats-preferences";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Stats" };

// Loading UI lives in ./loading.tsx.
export default async function StatsPage() {
  const user = await getCurrentUser();

  const [allStats, settings] = await Promise.all([
    computeAllStats(user.id),
    getUserSettingsRow(user.id),
  ]);

  return <StatsClient allStats={allStats} preferences={readStatsPreferences(settings?.statsPreferences)} />;
}
