import React from "react";
import { getUpcomingContests } from "@/lib/contests";
import { ContestReminder } from "@/components/contest-reminder";

/** Server side of the top-bar contest reminder: fetches (cached) and hands off to the ticking chip. */
export async function ContestReminderSlot() {
  const contests = await getUpcomingContests();
  return <ContestReminder contests={contests} />;
}
