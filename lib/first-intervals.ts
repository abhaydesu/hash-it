/**
 * First-review waits for newly logged problems. Kept apart from the scheduler so
 * client components can show them without bundling the FSRS library.
 */
type Rating = "AGAIN" | "HARD" | "GOOD" | "EASY";
export type LoggedStatus = "SOLVED_UNAIDED" | "SOLVED_WITH_HELP" | "ATTEMPTED_FAILED";

/** How long a newly logged problem waits before its first review, by outcome. */
export const DEFAULT_FIRST_INTERVALS = {
  cold: 14,
  hint: 10,
  solution: 7,
  flagged: 4,
} as const;

export type FirstIntervals = { [K in keyof typeof DEFAULT_FIRST_INTERVALS]: number };

/**
 * First-log interval. The revisit flag wins over the outcome. Cold covers both
 * Good and Easy: on a first log, speed does not shorten the wait.
 */
export function firstIntervalFor(
  rating: Rating,
  flagged = false,
  intervals: FirstIntervals = DEFAULT_FIRST_INTERVALS,
): number {
  if (flagged) return intervals.flagged;
  if (rating === "AGAIN") return intervals.solution;
  if (rating === "HARD") return intervals.hint;
  return intervals.cold;
}

/** Same wait, from the outcome the user picks in the log form. */
export function firstIntervalForStatus(
  status: LoggedStatus,
  flagged = false,
  intervals: FirstIntervals = DEFAULT_FIRST_INTERVALS,
): number {
  const rating: Rating = status === "ATTEMPTED_FAILED" ? "AGAIN" : status === "SOLVED_WITH_HELP" ? "HARD" : "GOOD";
  return firstIntervalFor(rating, flagged, intervals);
}

export function firstIntervalsFrom(
  settings?: {
    firstIntervalCold?: number | null;
    firstIntervalHint?: number | null;
    firstIntervalSolution?: number | null;
    firstIntervalFlagged?: number | null;
  } | null,
): FirstIntervals {
  return {
    cold: settings?.firstIntervalCold ?? DEFAULT_FIRST_INTERVALS.cold,
    hint: settings?.firstIntervalHint ?? DEFAULT_FIRST_INTERVALS.hint,
    solution: settings?.firstIntervalSolution ?? DEFAULT_FIRST_INTERVALS.solution,
    flagged: settings?.firstIntervalFlagged ?? DEFAULT_FIRST_INTERVALS.flagged,
  };
}
