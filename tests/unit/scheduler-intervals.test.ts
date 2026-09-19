import { describe, it, expect } from "vitest";
import {
  deriveRating,
  deriveLane,
  seedCard,
  advanceCard,
  DEFAULT_BASELINES,
  MAX_INTERVAL_DAYS,
  LAPSE_INTERVAL_DAYS,
  type AppRating,
  type ProblemDifficulty,
  type ReviewCardData,
  type SolveStatusType,
} from "@/lib/scheduler";

/**
 * Schedule sweep: for every difficulty x outcome x solve time, what does the
 * scheduler actually hand back? Prints a table alongside the assertions so the
 * numbers can be eyeballed without logging problems by hand.
 */

const RETENTION = 0.8;
const NOW = new Date("2026-09-20T00:00:00Z");
const MINUTE_GRID = [10, 20, 30, 40, 50, 60, 75, 90, 120];
const DIFFICULTIES: ProblemDifficulty[] = ["EASY", "MEDIUM", "HARD"];

type Outcome = {
  label: string;
  status: SolveStatusType;
  usedHint?: boolean;
};

const OUTCOMES: Outcome[] = [
  { label: "solved cold", status: "SOLVED_UNAIDED" },
  { label: "used hint", status: "SOLVED_UNAIDED", usedHint: true },
  { label: "solved w/ help", status: "SOLVED_WITH_HELP" },
  { label: "failed", status: "ATTEMPTED_FAILED" },
];

function daysBetween(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / 86_400_000;
}

function fmtDays(d: number): string {
  if (d < 1) return `${Math.round(d * 24)}h`;
  if (d < 365) return `${d.toFixed(0)}d`;
  return `${(d / 365).toFixed(1)}y`;
}

/** Apply an outcome to a card on its due date; return rating + days until next review. */
function review(card: ReviewCardData, outcome: Outcome, difficulty: ProblemDifficulty, minutes: number | null) {
  const rating = deriveRating({
    status: outcome.status,
    usedHint: outcome.usedHint,
    difficulty,
    minutes,
  });
  const reviewedAt = new Date(card.due);
  const next = advanceCard({
    currentCard: card,
    rating,
    reviewDate: reviewedAt,
    desiredRetention: RETENTION,
  });
  return { rating, days: daysBetween(reviewedAt, next.due), next };
}

/** A card that has already survived `reps` clean cold reviews. */
function maturedCard(reps: number): ReviewCardData {
  let card = seedCard({ entryId: "m", rating: "GOOD", now: NOW, desiredRetention: RETENTION });
  for (let i = 0; i < reps; i++) {
    card = advanceCard({
      currentCard: card,
      rating: "GOOD",
      reviewDate: new Date(card.due),
      desiredRetention: RETENTION,
    });
  }
  return card;
}

const STAGES: Array<{ label: string; card: () => ReviewCardData }> = [
  { label: "1st review (just logged)", card: () => maturedCard(0) },
  { label: "2nd review", card: () => maturedCard(1) },
  { label: "4th review (mature)", card: () => maturedCard(3) },
];

type Step = { day: number; lane: string; rating: AppRating };

/**
 * Walk a problem forward from the moment it is logged. Logging writes an
 * Attempt, so its rating decides the first review's lane; from there each
 * review's own rating decides the next one.
 *
 * RESOLVE reviews are re-solved at the same pace the problem was logged at.
 * RECALL reviews are self-rated, and we assume the user passes them (GOOD).
 */
function trajectory(
  difficulty: ProblemDifficulty,
  outcome: Outcome,
  minutes: number | null,
  steps: number
): { logRating: AppRating; path: Step[] } {
  const logRating = deriveRating({
    status: outcome.status,
    usedHint: outcome.usedHint,
    difficulty,
    minutes,
  });

  // The log's own rating seeds the card, so solve speed shapes the first interval.
  let card = seedCard({
    entryId: "t",
    rating: logRating,
    now: NOW,
    desiredRetention: RETENTION,
  });
  let lastRating = logRating;
  const path: Step[] = [];

  for (let i = 0; i < steps; i++) {
    const lane = deriveLane({ lastRating, lapses: card.lapses, stability: card.stability });
    const dueAt = new Date(card.due);
    // A re-solve is graded on the clock; a quick recall is self-rated.
    const rating: AppRating =
      lane === "RESOLVE"
        ? deriveRating({ status: outcome.status, usedHint: outcome.usedHint, difficulty, minutes })
        : "GOOD";

    path.push({
      day: daysBetween(NOW, dueAt),
      lane: lane === "RESOLVE" ? "re-solve" : "quick",
      rating,
    });

    card = advanceCard({ currentCard: card, rating, reviewDate: dueAt, desiredRetention: RETENTION });
    lastRating = rating;
  }

  return { logRating, path };
}

const LOG_CASES: Array<{ label: string; outcome: Outcome; minutes: number | null }> = [
  ...MINUTE_GRID.map((m) => ({ label: `cold, ${m} min`, outcome: OUTCOMES[0], minutes: m })),
  { label: "cold, no time logged", outcome: OUTCOMES[0], minutes: null },
  { label: "used hint, 40 min", outcome: OUTCOMES[1], minutes: 40 },
  { label: "solved w/ help, 40 min", outcome: OUTCOMES[2], minutes: 40 },
  { label: "failed", outcome: OUTCOMES[3], minutes: 40 },
];

const REVIEW_COLUMNS = 5;

describe("scheduler interval sweep", () => {
  it("prints the review trajectory table", () => {
    const lines: string[] = [];
    lines.push("");
    lines.push(`desiredRetention = ${RETENTION}   baselines = easy ${DEFAULT_BASELINES.easy}m / medium ${DEFAULT_BASELINES.medium}m / hard ${DEFAULT_BASELINES.hard}m`);
    lines.push("Each cell = how long after LOGGING the problem resurfaces, and in which form.");
    lines.push("Recall reviews are assumed passed. h = hours, d = days, y = years.");

    const head =
      "  logged as".padEnd(26) +
      "rating".padEnd(8) +
      Array.from({ length: REVIEW_COLUMNS }, (_, i) => `${i + 1}${["st", "nd", "rd", "th", "th"][i]} review`.padEnd(18)).join("");

    for (const difficulty of DIFFICULTIES) {
      lines.push("");
      lines.push(`━━ ${difficulty} ` + "━".repeat(100 - difficulty.length));
      lines.push(head);
      for (const c of LOG_CASES) {
        const { logRating, path } = trajectory(difficulty, c.outcome, c.minutes, REVIEW_COLUMNS);
        const cells = path.map((s) => `${fmtDays(s.day).padStart(5)} · ${s.lane}`.padEnd(18)).join("");
        lines.push(`  ${c.label}`.padEnd(26) + logRating.padEnd(8) + cells);
      }
    }

    lines.push("");

    console.log(lines.join("\n"));
    expect(lines.length).toBeGreaterThan(0);
  });

  describe("a cold solve is never punished for being slow", () => {
    it.each(DIFFICULTIES)("%s: every solve time rates EASY or GOOD, never HARD/AGAIN", (difficulty) => {
      for (const minutes of [...MINUTE_GRID, 300, 600]) {
        const rating = deriveRating({ status: "SOLVED_UNAIDED", difficulty, minutes });
        expect(["EASY", "GOOD"]).toContain(rating);
      }
      expect(deriveRating({ status: "SOLVED_UNAIDED", difficulty, minutes: null })).toBe("GOOD");
    });

    it.each(DIFFICULTIES)("%s: a freshly logged problem never returns in under a week", (difficulty) => {
      for (const minutes of [...MINUTE_GRID, 300]) {
        const { days } = review(maturedCard(0), OUTCOMES[0], difficulty, minutes);
        expect(days).toBeGreaterThanOrEqual(7);
      }
    });

    it.each(DIFFICULTIES)("%s: taking longer never shortens the interval", (difficulty) => {
      for (const stage of STAGES) {
        const seq = MINUTE_GRID.map((m) => review(stage.card(), OUTCOMES[0], difficulty, m).days);
        for (let i = 1; i < seq.length; i++) {
          expect(seq[i]).toBeLessThanOrEqual(seq[i - 1]);
        }
      }
    });
  });

  describe("outcomes stay correctly ordered", () => {
    it.each(DIFFICULTIES)("%s: cold > hint, and cold > with-help, at equal solve time", (difficulty) => {
      for (const minutes of MINUTE_GRID) {
        const cold = review(maturedCard(0), OUTCOMES[0], difficulty, minutes).days;
        const hint = review(maturedCard(0), OUTCOMES[1], difficulty, minutes).days;
        const help = review(maturedCard(0), OUTCOMES[2], difficulty, minutes).days;
        expect(cold).toBeGreaterThan(hint);
        expect(cold).toBeGreaterThan(help);
      }
    });

    it.each(DIFFICULTIES)("%s: help and hint are treated the same regardless of speed", (difficulty) => {
      for (const minutes of MINUTE_GRID) {
        expect(deriveRating({ status: "SOLVED_UNAIDED", usedHint: true, difficulty, minutes })).toBe("HARD");
        expect(deriveRating({ status: "SOLVED_WITH_HELP", difficulty, minutes })).toBe("HARD");
      }
    });

    it.each(DIFFICULTIES)("%s: a failure always rates AGAIN and comes back soonest", (difficulty) => {
      for (const minutes of MINUTE_GRID) {
        expect(deriveRating({ status: "ATTEMPTED_FAILED", difficulty, minutes })).toBe("AGAIN");
        const failed = review(maturedCard(3), OUTCOMES[3], difficulty, minutes).days;
        const hint = review(maturedCard(3), OUTCOMES[1], difficulty, minutes).days;
        const cold = review(maturedCard(3), OUTCOMES[0], difficulty, minutes).days;
        expect(failed).toBeLessThan(hint);
        expect(hint).toBeLessThan(cold);
      }
    });
  });

  describe("the EASY speed bonus tracks each difficulty's baseline", () => {
    it.each(DIFFICULTIES)("%s: EASY at or under 0.75x baseline, GOOD past it", (difficulty) => {
      const baseline =
        difficulty === "EASY" ? DEFAULT_BASELINES.easy
        : difficulty === "HARD" ? DEFAULT_BASELINES.hard
        : DEFAULT_BASELINES.medium;
      const cutoff = Math.round(0.75 * baseline);

      expect(deriveRating({ status: "SOLVED_UNAIDED", difficulty, minutes: cutoff })).toBe("EASY");
      expect(deriveRating({ status: "SOLVED_UNAIDED", difficulty, minutes: cutoff + 1 })).toBe("GOOD");

      const fast = review(maturedCard(0), OUTCOMES[0], difficulty, cutoff).days;
      const slow = review(maturedCard(0), OUTCOMES[0], difficulty, cutoff + 1).days;
      expect(fast).toBeGreaterThan(slow);
    });
  });

  it("intervals compound across clean cold solves, then hold at the cap", () => {
    let card = seedCard({ entryId: "c", rating: "GOOD", now: NOW, desiredRetention: RETENTION });
    let previous = 0;
    for (let i = 0; i < 8; i++) {
      const at = new Date(card.due);
      card = advanceCard({ currentCard: card, rating: "GOOD", reviewDate: at, desiredRetention: RETENTION });
      const days = daysBetween(at, card.due);
      // Intervals stretch until they saturate: never shrink, never past the cap.
      expect(days).toBeGreaterThanOrEqual(previous);
      expect(days).toBeLessThanOrEqual(MAX_INTERVAL_DAYS + 1);
      previous = days;
    }
    // A problem solved cleanly this many times should be out near the cap.
    expect(previous).toBeGreaterThan(300);
  });

  it("never schedules anything sooner than a day, for any outcome or maturity", () => {
    for (const stage of STAGES) {
      for (const difficulty of DIFFICULTIES) {
        for (const outcome of OUTCOMES) {
          const { days } = review(stage.card(), outcome, difficulty, 40);
          expect(days).toBeGreaterThanOrEqual(1);
        }
      }
    }
  });

  it("brings a failed problem back promptly however strong it had become", () => {
    for (const reps of [0, 1, 3, 5]) {
      const { days } = review(maturedCard(reps), OUTCOMES[3], "MEDIUM", 40);
      expect(days).toBeGreaterThanOrEqual(1);
      expect(days).toBeLessThanOrEqual(LAPSE_INTERVAL_DAYS);
    }
  });

  it("schedules every logged problem, whatever the outcome", () => {
    for (const rating of ["AGAIN", "HARD", "GOOD", "EASY"] as AppRating[]) {
      const card = seedCard({ entryId: "s", rating, now: NOW, desiredRetention: RETENTION });
      expect(daysBetween(NOW, card.due)).toBeGreaterThanOrEqual(1);
    }
  });
});
