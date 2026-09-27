/**
 * Upcoming LeetCode contests. Read from LeetCode's public GraphQL endpoint (cached for
 * an hour); if that fails, computed from the fixed schedule so the reminder never breaks.
 */

export interface Contest {
  title: string;
  url: string;
  /** Epoch ms. */
  startTime: number;
  durationMs: number;
}

const WEEK_MS = 7 * 86_400_000;
const DURATION_MS = 90 * 60_000;

/**
 * Known contests used to extrapolate the schedule: weekly contests run every Sunday
 * 02:30 UTC, biweekly ones every other Saturday 14:30 UTC.
 */
const ANCHORS = [
  { kind: "Weekly", number: 522, slug: "weekly-contest", startTime: Date.UTC(2026, 9, 4, 2, 30), every: WEEK_MS },
  { kind: "Biweekly", number: 193, slug: "biweekly-contest", startTime: Date.UTC(2026, 9, 10, 14, 30), every: 2 * WEEK_MS },
] as const;

/** The next occurrence (not yet finished) of each contest series, soonest first. */
export function scheduledContests(now: Date): Contest[] {
  return ANCHORS.map((a) => {
    // Smallest k with start + duration > now (k may be negative for dates before the anchor).
    const k = Math.ceil((now.getTime() - DURATION_MS - a.startTime) / a.every + 1e-9);
    const n = a.number + k;
    return {
      title: `${a.kind} Contest ${n}`,
      url: `https://leetcode.com/contest/${a.slug}-${n}/`,
      startTime: a.startTime + k * a.every,
      durationMs: DURATION_MS,
    };
  }).sort((x, y) => x.startTime - y.startTime);
}

const QUERY = "{ topTwoContests { title titleSlug startTime duration } }";

export async function getUpcomingContests(now: Date = new Date()): Promise<Contest[]> {
  try {
    const res = await fetch("https://leetcode.com/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json", Referer: "https://leetcode.com" },
      body: JSON.stringify({ query: QUERY }),
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) throw new Error(`LeetCode responded ${res.status}`);
    const json = (await res.json()) as {
      data?: { topTwoContests?: Array<{ title: string; titleSlug: string; startTime: number; duration: number }> };
    };
    const contests = (json.data?.topTwoContests ?? [])
      .map((c) => ({
        title: c.title,
        url: `https://leetcode.com/contest/${c.titleSlug}/`,
        startTime: c.startTime * 1000,
        durationMs: c.duration * 1000,
      }))
      .filter((c) => c.startTime + c.durationMs > now.getTime())
      .sort((a, b) => a.startTime - b.startTime);
    if (contests.length === 0) throw new Error("No upcoming contests returned");
    return contests;
  } catch {
    return scheduledContests(now);
  }
}
