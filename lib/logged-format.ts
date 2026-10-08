/** What the log form needs to know about a problem the user has already logged. */
export interface LoggedInfo {
  entryId: string;
  status: "SOLVED_UNAIDED" | "SOLVED_WITH_HELP" | "ATTEMPTED_FAILED";
  /** ISO time of the latest attempt (or first log). */
  lastAt: string;
  /** ISO due date of the review card, if the problem is in rotation. */
  nextDue: string | null;
}

const DAY_MS = 86_400_000;

/** "today", "yesterday", "5 days ago", then a date once it is over a month old. */
export function formatAgo(iso: string, now: Date = new Date()): string {
  const days = Math.floor((now.getTime() - new Date(iso).getTime()) / DAY_MS);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 31) return `${days} days ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

/** "due today", "due in 6 days" or "overdue by 3 days". */
export function formatDue(iso: string, now: Date = new Date()): string {
  const days = Math.round((new Date(iso).getTime() - now.getTime()) / DAY_MS);
  if (days === 0) return "due today";
  if (days > 0) return `due in ${days} ${days === 1 ? "day" : "days"}`;
  return `overdue by ${-days} ${days === -1 ? "day" : "days"}`;
}
