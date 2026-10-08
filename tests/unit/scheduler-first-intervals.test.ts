import { describe, it, expect } from "vitest";
import { fsrs, generatorParameters } from "ts-fsrs";
import {
  APP_RATING_TO_FSRS,
  advanceCard,
  deriveLane,
  failedRecallPending,
  fillResolveMinimum,
  neverSolvedCold,
  firstIntervalFor,
  hasQueueReview,
  seedCard,
  stabilityForInterval,
  toFSRSCard,
  DEFAULT_FIRST_INTERVALS,
  MAX_INTERVAL_DAYS,
  MIN_INTERVAL_DAYS,
  type AppRating,
} from "@/lib/scheduler";

const NOW = new Date("2026-10-08T00:00:00.000Z");
const DAY = 86_400_000;

function daysOut(due: Date) {
  return Math.round((due.getTime() - NOW.getTime()) / DAY);
}

describe("fixed first intervals", () => {
  it.each([
    ["AGAIN", DEFAULT_FIRST_INTERVALS.solution],
    ["HARD", DEFAULT_FIRST_INTERVALS.hint],
    ["GOOD", DEFAULT_FIRST_INTERVALS.cold],
    ["EASY", DEFAULT_FIRST_INTERVALS.cold],
  ] as const)("seeds %s at its first interval, ±1 day", (rating, days) => {
    const card = seedCard({ entryId: "e", rating, now: NOW });
    expect(Math.abs(card.scheduledDays - days)).toBeLessThanOrEqual(1);
    expect(Math.abs(daysOut(card.due) - days)).toBeLessThanOrEqual(1);
  });

  it.each(["AGAIN", "HARD", "GOOD", "EASY"] as const)(
    "the revisit flag overrides a %s first interval",
    (rating) => {
      const card = seedCard({ entryId: "e", rating, now: NOW, flagged: true });
      expect(Math.abs(card.scheduledDays - DEFAULT_FIRST_INTERVALS.flagged)).toBeLessThanOrEqual(1);
      expect(Math.abs(daysOut(card.due) - DEFAULT_FIRST_INTERVALS.flagged)).toBeLessThanOrEqual(1);
    },
  );
});

describe("stability round-trip", () => {
  it.each([0.7, 0.8, 0.9])("retention %s schedules the seeded interval, ±1 day", (retention) => {
    const f = fsrs(
      generatorParameters({
        request_retention: retention,
        maximum_interval: MAX_INTERVAL_DAYS,
        enable_short_term: false,
      }),
    );
    for (const days of Object.values(DEFAULT_FIRST_INTERVALS)) {
      const stability = stabilityForInterval(days, retention);
      expect(Math.abs(f.next_interval(stability, 0) - days)).toBeLessThanOrEqual(1);
    }
  });
});

describe("Again on a review follows FSRS", () => {
  it("is not forced to 3 days, and never lands under 2", () => {
    const seeded = seedCard({ entryId: "e", rating: "GOOD", now: NOW });
    const reviewDate = seeded.due;
    const f = fsrs(
      generatorParameters({
        request_retention: 0.8,
        maximum_interval: MAX_INTERVAL_DAYS,
        enable_short_term: false,
      }),
    );
    const raw = f.repeat(toFSRSCard(seeded), reviewDate)[APP_RATING_TO_FSRS.AGAIN].card.scheduled_days;
    const advanced = advanceCard({ currentCard: seeded, rating: "AGAIN", reviewDate });

    expect(advanced.scheduledDays).toBeGreaterThanOrEqual(MIN_INTERVAL_DAYS);
    expect(advanced.scheduledDays).toBe(Math.max(raw, MIN_INTERVAL_DAYS));
    expect(advanced.scheduledDays).not.toBe(3);
  });

  it("lifts a sub-day FSRS lapse up to the 2-day floor", () => {
    const seeded = seedCard({ entryId: "e", rating: "AGAIN", now: NOW });
    seeded.stability = 0.05;
    const advanced = advanceCard({ currentCard: seeded, rating: "AGAIN", reviewDate: NOW });
    expect(advanced.scheduledDays).toBeGreaterThanOrEqual(MIN_INTERVAL_DAYS);
    expect(advanced.due.getTime()).toBeGreaterThanOrEqual(NOW.getTime() + MIN_INTERVAL_DAYS * DAY);
  });
});

describe("lane routing", () => {
  const outcomes: AppRating[] = ["AGAIN", "HARD", "GOOD", "EASY"];

  it("sends a never-reviewed card to recall for every outcome, including saw solution", () => {
    expect(hasQueueReview([{ lane: null }])).toBe(false);
    for (const rating of outcomes) {
      const card = seedCard({ entryId: rating, rating, now: NOW });
      expect(card.reps).toBe(1);
      expect(deriveLane({ reviewed: hasQueueReview([{ lane: null }]), lapses: card.lapses })).toBe(
        "RECALL",
      );
    }
  });

  it("sends a flagged card to resolve", () => {
    expect(deriveLane({ reviewed: false, revisit: true })).toBe("RESOLVE");
    expect(deriveLane({ reviewed: true, revisit: true, lapses: 0 })).toBe("RESOLVE");
  });

  it("sends a card with two lapses to resolve", () => {
    expect(deriveLane({ reviewed: true, lapses: 2 })).toBe("RESOLVE");
  });

  it("sends a card marked after a failed recall to resolve, and clears that on the next cold solve", () => {
    const failed = { rating: "AGAIN" as const, lane: "RECALL" as const, at: new Date("2026-10-09T00:00:00.000Z") };
    expect(failedRecallPending([failed])).toBe(true);
    expect(deriveLane({ reviewed: true, failedRecall: true })).toBe("RESOLVE");

    const cold = { rating: "GOOD" as const, lane: null, at: new Date("2026-10-16T00:00:00.000Z") };
    expect(failedRecallPending([failed, cold])).toBe(false);
    expect(deriveLane({ reviewed: true, failedRecall: failedRecallPending([failed, cold]) })).toBe("RECALL");
  });

  it("does not treat an IMPORT attempt (no lane) as a queue review", () => {
    expect(hasQueueReview([{ lane: null }])).toBe(false);
    expect(deriveLane({ reviewed: hasQueueReview([{ lane: null }]), lapses: 0 })).toBe("RECALL");
  });

  it("keeps a failed recall newer than an old IMPORT Good on resolve", () => {
    const imported = { rating: "GOOD" as const, lane: null, at: new Date("2026-06-01T00:00:00.000Z") };
    const failed = { rating: "AGAIN" as const, lane: "RECALL" as const, at: new Date("2026-10-09T00:00:00.000Z") };
    expect(failedRecallPending([failed, imported])).toBe(true);
  });

  it("sends a reviewed card that was never solved cold to resolve", () => {
    expect(deriveLane({ reviewed: true, neverSolvedCold: true, lapses: 0 })).toBe("RESOLVE");
    expect(deriveLane({ reviewed: false, neverSolvedCold: true })).toBe("RECALL");
  });

  it("neverSolvedCold: a recall pass is not a cold solve, an import or resolve Good is", () => {
    const at = new Date("2026-10-01T00:00:00.000Z");
    const log = { rating: "AGAIN" as const, lane: null, at };
    const recallPass = { rating: "GOOD" as const, lane: "RECALL" as const, at };
    expect(neverSolvedCold([log, recallPass])).toBe(true);
    expect(neverSolvedCold([{ rating: "GOOD", lane: null, at }, recallPass])).toBe(false);
    expect(neverSolvedCold([log, { rating: "EASY", lane: "RESOLVE", at }])).toBe(false);
    expect(neverSolvedCold([{ rating: "HARD", lane: null, at }])).toBe(true);
  });

  it("keeps a clean mature card on recall", () => {
    expect(deriveLane({ reviewed: true, lapses: 0, revisit: false, failedRecall: false })).toBe("RECALL");
  });

  it("keeps a card with stability under 30 days on recall when its history is clean", () => {
    const young = seedCard({ entryId: "young", rating: "GOOD", now: NOW });
    expect(young.stability).toBeLessThan(30);
    expect(
      deriveLane({
        reviewed: true,
        lapses: 0,
        revisit: false,
        failedRecall: false,
      }),
    ).toBe("RECALL");
  });
});

describe("firstIntervalFor", () => {
  it("uses the flag before the rating", () => {
    expect(firstIntervalFor("AGAIN", true)).toBe(4);
    expect(firstIntervalFor("GOOD", false)).toBe(14);
  });
});

describe("fillResolveMinimum", () => {
  const item = (entryId: string, due: string, extra: Record<string, unknown> = {}) => ({
    entryId,
    due: new Date(due),
    lapses: 0,
    reps: 1,
    lane: "RECALL" as const,
    ...extra,
  });
  const resolveIds = (items: Array<{ entryId: string; lane?: string }>) =>
    items.filter((i) => i.lane === "RESOLVE").map((i) => i.entryId);

  it("prefers never-solved-cold, oldest due first, then cards with lapses", () => {
    const items = [
      item("lapsed", "2026-09-01", { lapses: 1 }),
      item("new-young", "2026-10-01", { neverSolvedCold: true }),
      item("new-old", "2026-09-10", { neverSolvedCold: true }),
    ];
    expect(resolveIds(fillResolveMinimum(items, 1))).toEqual(["new-old"]);
    expect(resolveIds(fillResolveMinimum(items, 3)).sort()).toEqual(["lapsed", "new-old", "new-young"]);
  });

  it("never pulls in a card with no reason, or one already retrying tomorrow", () => {
    const items = [item("plain", "2026-09-01"), item("retry", "2026-09-02", { neverSolvedCold: true, retryTomorrow: true })];
    expect(resolveIds(fillResolveMinimum(items, 2))).toEqual([]);
  });

  it("returns the input untouched when nothing is needed", () => {
    const items = [item("a", "2026-09-01", { neverSolvedCold: true })];
    expect(fillResolveMinimum(items, 0)).toBe(items);
  });
});
