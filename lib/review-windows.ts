/**
 * When the weekly review and monthly mock are "due". Pure module — safe on client.
 *
 * Monthly: a mock opens on the last local day of each month. Missing one keeps it
 * open (overdue) until taken, but misses don't stack — only the latest month is owed.
 * Weekly: the review opens on Sunday and plans the Monday–Sunday week ahead. Monday is a
 * grace day for that same week; Tuesday–Saturday it's closed. A missed window lapses.
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

export interface WeeklyWindow {
  /** Whether the review (recall check + plan) can be done now. */
  open: boolean;
  /** Monday (YYYY-MM-DD) of the week the review plans — the upcoming week on Sunday, else this one. */
  planWeek: string;
  /** When the next window opens (local Sunday, 00:00). */
  nextOpensAt: number;
}

export function weeklyWindow(now: Date, timezone: string): WeeklyWindow {
  const monday = weekStart(now, timezone);
  const dow = new Date(`${localDay(now, timezone)}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  const isSunday = dow === 0;
  return {
    open: isSunday || dow === 1,
    planWeek: isSunday ? addDays(monday, 7) : monday,
    nextOpensAt: startOfLocalDay(addDays(monday, isSunday ? 13 : 6), timezone).getTime(),
  };
}
