import { cache } from "react";
import type { UserSettings } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const DEFAULT_TIMEZONE = "Asia/Kolkata";

/**
 * Per-request memo of each user's settings row. A page, its layout and every helper
 * they call share one lookup instead of each querying settings in turn.
 * Outside a React server render (server actions, route handlers) `cache` does not
 * memoize, so each call reads fresh — nothing can go stale after a write.
 */
const requestStore = cache(() => new Map<string, Promise<UserSettings | null>>());

export function getUserSettingsRow(userId: string): Promise<UserSettings | null> {
  const store = requestStore();
  let row = store.get(userId);
  if (!row) {
    row = prisma.userSettings.findUnique({ where: { userId } });
    store.set(userId, row);
  }
  return row;
}

/** Seed the memo with a row already loaded (getCurrentUser fetches it alongside the user). */
export function primeUserSettings(userId: string, row: UserSettings | null) {
  requestStore().set(userId, Promise.resolve(row));
}

export async function getUserTimezone(userId: string): Promise<string> {
  return (await getUserSettingsRow(userId))?.timezone || DEFAULT_TIMEZONE;
}
