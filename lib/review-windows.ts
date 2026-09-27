/**
 * When the weekly review and monthly mock are "due". Pure module — safe on client.
 *
 * Monthly: a mock opens on the last local day of each month. Missing one keeps it
 * open (overdue) until taken, but misses don't stack — only the latest month is owed.
 * Weekly: every calendar week (Monday start) has its own review; a missed week lapses.
 */
import { addDays, addMonths, lastDayOfMonth, localDay, startOfLocalDay, weekStart } from "@/lib/dates";

export type MonthlyStatus =
  /** Never taken one: open now, counts for this month. */
  | { state: "first"; creditPeriod: string }
  /** Due today (the month's last day) or overdue since `dueDay`. */
  | { state: "open"; creditPeriod: string; dueDay: string; overdue: boolean }
  /** This month's is done; the next opens at `opensAt`. Taking one early uses up `creditPeriod`. */
  | { state: "locked"; creditPeriod: string; opensAt: number };

/**
 * @param creditedPeriods months (YYYY-MM) that already have a completed mock
 */
export function monthlyStatus(now: Date, timezone: string, creditedPeriods: Iterable<string>): MonthlyStatus {
  const done = new Set(creditedPeriods);
  const today = localDay(now, timezone);
  const thisMonth = today.slice(0, 7);
  if (done.size === 0) return { state: "first", creditPeriod: thisMonth };

  // The latest month whose last day has arrived; earlier misses are forgiven. A mock
  // credited to a later month (a first or early one) also forgives everything before it.
  const latestDue = today >= lastDayOfMonth(thisMonth) ? thisMonth : addMonths(thisMonth, -1);
  const latestCredited = [...done].sort().at(-1)!;
  let month = latestCredited > latestDue ? latestCredited : latestDue;
  while (done.has(month)) month = addMonths(month, 1);

  const dueDay = lastDayOfMonth(month);
  if (dueDay <= today) return { state: "open", creditPeriod: month, dueDay, overdue: dueDay < today };
  return { state: "locked", creditPeriod: month, opensAt: startOfLocalDay(dueDay, timezone).getTime() };
}

/** When the next weekly review opens (next local Monday, 00:00). */
export function nextWeeklyReviewAt(now: Date, timezone: string): number {
  return startOfLocalDay(addDays(weekStart(now, timezone), 7), timezone).getTime();
}
