import React from "react";
import { auth } from "@/lib/auth";
import { computeStreakForUser } from "@/lib/stats-engine";
import { StreakChip } from "@/components/streak-chip";

/** Server side of the top-bar streak chip. Renders nothing when signed out or on error. */
export async function StreakSlot() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;
  try {
    const streak = await computeStreakForUser(userId);
    return <StreakChip current={streak.current} todayDone={streak.todayDone} />;
  } catch (err) {
    console.error("[StreakSlot]", err);
    return null;
  }
}
