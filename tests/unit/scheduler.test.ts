import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  deriveRating,
  deriveLane,
  seedCard,
  advanceCard,
  calculateRetrievability,
  isLeech,
  interleaveLane,
  interleaveQueue,
  spreadImportDueDates,
  DEFAULT_BASELINES,
  type QueueItem,
  type ReviewCardData,
} from "@/lib/scheduler";

describe("lib/scheduler.ts unit tests", () => {
  const fixedNow = new Date("2026-09-17T12:00:00.000Z");

  beforeEach(() => {
    vi.useFakeTimers({ now: fixedNow });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("deriveRating", () => {
    describe("status and flag overrides", () => {
      it("always returns AGAIN when status is ATTEMPTED_FAILED regardless of minutes or hints", () => {
        expect(deriveRating({ status: "ATTEMPTED_FAILED", minutes: 5 })).toBe("AGAIN");
        expect(deriveRating({ status: "ATTEMPTED_FAILED", minutes: 30, usedHint: true })).toBe("AGAIN");
        expect(deriveRating({ status: "ATTEMPTED_FAILED", minutes: null })).toBe("AGAIN");
      });

      it("returns HARD when usedHint is true on a solved problem", () => {
        expect(deriveRating({ status: "SOLVED_UNAIDED", usedHint: true, minutes: 5 })).toBe("HARD");
        expect(deriveRating({ status: "SOLVED_WITH_HELP", usedHint: true, minutes: 10 })).toBe("HARD");
      });

      it("returns HARD when minutes is null or undefined on a solved problem", () => {
        expect(deriveRating({ status: "SOLVED_UNAIDED", minutes: null })).toBe("HARD");
        expect(deriveRating({ status: "SOLVED_UNAIDED", minutes: undefined })).toBe("HARD");
      });
    });

    describe("time-vs-baseline thresholds and boundaries", () => {
      // For MEDIUM default baseline is 30m.
      // 0.6 * 30 = 18m.
      // 2 * 30 = 60m.
      // <= 18 -> EASY
      // 19 .. 60 -> GOOD
      // > 60 -> HARD
      const mediumTestCases = [
        { desc: "negative minutes", minutes: -5, expected: "EASY" },
        { desc: "zero minutes", minutes: 0, expected: "EASY" },
        { desc: "well under threshold (10m)", minutes: 10, expected: "EASY" },
        { desc: "one below 0.6x baseline (17m)", minutes: 17, expected: "EASY" },
        { desc: "exactly at 0.6x baseline (18m)", minutes: 18, expected: "EASY" },
        { desc: "one above 0.6x baseline (19m)", minutes: 19, expected: "GOOD" },
        { desc: "one below baseline (29m)", minutes: 29, expected: "GOOD" },
        { desc: "exactly at baseline (30m)", minutes: 30, expected: "GOOD" },
        { desc: "one above baseline (31m)", minutes: 31, expected: "GOOD" },
        { desc: "one below 2x baseline (59m)", minutes: 59, expected: "GOOD" },
        { desc: "exactly at 2x baseline (60m)", minutes: 60, expected: "GOOD" },
        { desc: "one above 2x baseline (61m)", minutes: 61, expected: "HARD" },
        { desc: "far above threshold (500m)", minutes: 500, expected: "HARD" },
      ];

      it.each(mediumTestCases)("medium difficulty: $desc ($minutes mins -> $expected)", ({ minutes, expected }) => {
        expect(
          deriveRating({
            status: "SOLVED_UNAIDED",
            difficulty: "MEDIUM",
            minutes,
          })
        ).toBe(expected);
      });

      // EASY default baseline is 15m.
      // 0.6 * 15 = 9m.
      // 2 * 15 = 30m.
      const easyTestCases = [
        { desc: "exactly 0.6x (9m)", minutes: 9, expected: "EASY" },
        { desc: "one above 0.6x (10m)", minutes: 10, expected: "GOOD" },
        { desc: "exactly baseline (15m)", minutes: 15, expected: "GOOD" },
        { desc: "exactly 2x (30m)", minutes: 30, expected: "GOOD" },
        { desc: "one above 2x (31m)", minutes: 31, expected: "HARD" },
      ];

      it.each(easyTestCases)("easy difficulty: $desc ($minutes mins -> $expected)", ({ minutes, expected }) => {
        expect(
          deriveRating({
            status: "SOLVED_UNAIDED",
            difficulty: "EASY",
            minutes,
          })
        ).toBe(expected);
      });

      // HARD default baseline is 45m.
      // 0.6 * 45 = 27m.
      // 2 * 45 = 90m.
      const hardTestCases = [
        { desc: "exactly 0.6x (27m)", minutes: 27, expected: "EASY" },
        { desc: "one above 0.6x (28m)", minutes: 28, expected: "GOOD" },
        { desc: "exactly baseline (45m)", minutes: 45, expected: "GOOD" },
        { desc: "exactly 2x (90m)", minutes: 90, expected: "GOOD" },
        { desc: "one above 2x (91m)", minutes: 91, expected: "HARD" },
      ];

      it.each(hardTestCases)("hard difficulty: $desc ($minutes mins -> $expected)", ({ minutes, expected }) => {
        expect(
          deriveRating({
            status: "SOLVED_UNAIDED",
            difficulty: "HARD",
            minutes,
          })
        ).toBe(expected);
      });

      it("respects custom time baselines", () => {
        const customBaselines = { easy: 10, medium: 20, hard: 50 };
        // Medium: 0.6 * 20 = 12, 2 * 20 = 40
        expect(deriveRating({ status: "SOLVED_UNAIDED", difficulty: "MEDIUM", minutes: 12, baselines: customBaselines })).toBe("EASY");
        expect(deriveRating({ status: "SOLVED_UNAIDED", difficulty: "MEDIUM", minutes: 13, baselines: customBaselines })).toBe("GOOD");
        expect(deriveRating({ status: "SOLVED_UNAIDED", difficulty: "MEDIUM", minutes: 41, baselines: customBaselines })).toBe("HARD");
      });
    });
  });

  describe("deriveLane", () => {
    it("returns RECALL when lastRating is GOOD or EASY", () => {
      expect(deriveLane({ lastRating: "GOOD" })).toBe("RECALL");
      expect(deriveLane({ lastRating: "EASY" })).toBe("RECALL");
    });

    it("returns RESOLVE when revisit is true without prior GOOD/EASY rating", () => {
      expect(deriveLane({ revisit: true })).toBe("RESOLVE");
      expect(deriveLane({ revisit: true, lastRating: null })).toBe("RESOLVE");
    });

    it("returns RESOLVE when lapses >= 1 without prior GOOD/EASY rating", () => {
      expect(deriveLane({ lapses: 1 })).toBe("RESOLVE");
      expect(deriveLane({ lapses: 4 })).toBe("RESOLVE");
    });

    it("returns RESOLVE when lastRating is AGAIN or HARD", () => {
      expect(deriveLane({ lastRating: "AGAIN" })).toBe("RESOLVE");
      expect(deriveLane({ lastRating: "HARD" })).toBe("RESOLVE");
    });

    it("defaults to RECALL when no conditions match or lastRating is GOOD/EASY", () => {
      expect(deriveLane({})).toBe("RECALL");
      expect(deriveLane({ lapses: 0, revisit: false, lastRating: null })).toBe("RECALL");
      expect(deriveLane({ lastRating: "GOOD", lapses: 1 })).toBe("RECALL");
    });
  });

  describe("seedCard", () => {
    it("seeds card for SOLVED_UNAIDED with 1 rep and initial FSRS Learning state", () => {
      const card = seedCard({ entryId: "e1", status: "SOLVED_UNAIDED", now: fixedNow });
      expect(card.entryId).toBe("e1");
      expect(card.reps).toBe(1);
      expect(card.lapses).toBe(0);
      expect(card.state).toBe("LEARNING");
      expect(card.scheduledDays).toBeGreaterThanOrEqual(0);
      expect(card.due.getTime()).toBeGreaterThan(fixedNow.getTime());
    });

    it("seeds card for SOLVED_WITH_HELP with Hard grade", () => {
      const card = seedCard({ entryId: "e2", status: "SOLVED_WITH_HELP", now: fixedNow });
      expect(card.entryId).toBe("e2");
      expect(card.reps).toBe(1);
      expect(card.state).toBe("LEARNING");
    });

    it("seeds card for ATTEMPTED_FAILED with Learning state", () => {
      const card = seedCard({ entryId: "e3", status: "ATTEMPTED_FAILED", now: fixedNow });
      expect(card.entryId).toBe("e3");
      expect(card.state).toBe("LEARNING");
    });

    it("seeds card for revisit: true as Again / Learning even if status was SOLVED_UNAIDED", () => {
      const card = seedCard({ entryId: "e4", status: "SOLVED_UNAIDED", revisit: true, now: fixedNow });
      expect(card.entryId).toBe("e4");
      expect(card.state).toBe("LEARNING");
    });
  });

  describe("advanceCard", () => {
    const baseCard: ReviewCardData = {
      entryId: "e1",
      due: new Date(fixedNow),
      stability: 2.0,
      difficulty: 5.0,
      elapsedDays: 1,
      scheduledDays: 1,
      reps: 1,
      lapses: 0,
      state: "REVIEW",
      lastReview: new Date(fixedNow.getTime() - 86400000),
    };

    it("increments reps and schedules next review on GOOD", () => {
      const advanced = advanceCard({ currentCard: baseCard, rating: "GOOD", reviewDate: fixedNow });
      expect(advanced.reps).toBe(2);
      expect(advanced.lapses).toBe(0);
      expect(advanced.due.getTime()).toBeGreaterThan(fixedNow.getTime());
    });

    it("increments lapses and transitions to RELEARNING on AGAIN", () => {
      const advanced = advanceCard({ currentCard: baseCard, rating: "AGAIN", reviewDate: fixedNow });
      expect(advanced.lapses).toBe(1);
      expect(advanced.state).toBe("RELEARNING");
    });

    it("adjusts difficulty upwards on HARD", () => {
      const advanced = advanceCard({ currentCard: baseCard, rating: "HARD", reviewDate: fixedNow });
      expect(advanced.difficulty).toBeGreaterThanOrEqual(baseCard.difficulty);
    });

    it("increases stability and intervals significantly on EASY", () => {
      const advanced = advanceCard({ currentCard: baseCard, rating: "EASY", reviewDate: fixedNow });
      expect(advanced.stability).toBeGreaterThan(baseCard.stability);
    });
  });

  describe("calculateRetrievability & isLeech", () => {
    it("returns 0 when stability <= 0", () => {
      const card = { entryId: "e1", stability: 0, difficulty: 5, elapsedDays: 1, scheduledDays: 1, reps: 1, lapses: 0, state: "REVIEW" as const, due: fixedNow, lastReview: fixedNow };
      expect(calculateRetrievability(card, fixedNow)).toBe(0);
    });

    it("returns 1.0 when lastReview is missing or elapsedDays is 0", () => {
      const card = { entryId: "e1", stability: 5, difficulty: 5, elapsedDays: 0, scheduledDays: 1, reps: 1, lapses: 0, state: "REVIEW" as const, due: fixedNow, lastReview: null };
      expect(calculateRetrievability(card, fixedNow)).toBe(1.0);

      const cardToday = { ...card, lastReview: fixedNow };
      expect(calculateRetrievability(cardToday, fixedNow)).toBe(1.0);
    });

    it("calculates retrievability decaying between 0 and 1 over time", () => {
      const twoDaysAgo = new Date(fixedNow.getTime() - 2 * 86400000);
      const card = { entryId: "e1", stability: 2.0, difficulty: 5, elapsedDays: 2, scheduledDays: 2, reps: 1, lapses: 0, state: "REVIEW" as const, due: fixedNow, lastReview: twoDaysAgo };
      const r = calculateRetrievability(card, fixedNow);
      expect(r).toBeGreaterThan(0.5);
      expect(r).toBeLessThan(1.0);

      const twentyDaysAgo = new Date(fixedNow.getTime() - 20 * 86400000);
      const decayedCard = { ...card, lastReview: twentyDaysAgo };
      const rDecayed = calculateRetrievability(decayedCard, fixedNow);
      expect(rDecayed).toBeLessThan(r);
      expect(rDecayed).toBeGreaterThan(0.0);
    });

    it("identifies leeches when lapses >= 3", () => {
      expect(isLeech({ lapses: 0 })).toBe(false);
      expect(isLeech({ lapses: 2 })).toBe(false);
      expect(isLeech({ lapses: 3 })).toBe(true);
      expect(isLeech({ lapses: 5 })).toBe(true);
    });
  });

  describe("interleaveLane & interleaveQueue", () => {
    function makeItem(id: string, dueOffsetDays: number, lapses: number, family: string, lane: "RESOLVE" | "RECALL" = "RESOLVE"): QueueItem {
      const due = new Date(fixedNow.getTime() + dueOffsetDays * 86400000);
      return { entryId: id, due, lapses, reps: 1, family, lane };
    }

    describe("cap, ordering, and lapses", () => {
      it("respects cap = 0, cap = 1, cap = 2", () => {
        const items = [
          makeItem("1", -2, 0, "F1"),
          makeItem("2", -1, 0, "F2"),
          makeItem("3", 0, 0, "F3"),
        ];
        expect(interleaveLane(items, 0)).toHaveLength(0);
        expect(interleaveLane(items, 1)).toHaveLength(1);
        expect(interleaveLane(items, 2)).toHaveLength(2);
      });

      it("prioritizes overdue before due-today", () => {
        const items = [
          makeItem("due-today", 0, 5, "F1"),
          makeItem("overdue-1", -1, 0, "F2"),
          makeItem("overdue-2", -3, 0, "F3"),
        ];
        const res = interleaveLane(items, 3);
        expect(res.map((r) => r.entryId)).toEqual(["overdue-2", "overdue-1", "due-today"]);
      });

      it("prioritizes higher lapses when due dates are equal", () => {
        const items = [
          makeItem("low-lapse", -1, 1, "F1"),
          makeItem("high-lapse", -1, 4, "F2"),
          makeItem("zero-lapse", -1, 0, "F3"),
        ];
        const res = interleaveLane(items, 3);
        expect(res[0].entryId).toBe("high-lapse");
        expect(res[1].entryId).toBe("low-lapse");
        expect(res[2].entryId).toBe("zero-lapse");
      });

      it("behaves correctly when fewer cards are due than the cap", () => {
        const items = [makeItem("1", -1, 0, "F1")];
        const res = interleaveLane(items, 5);
        expect(res).toHaveLength(1);
        expect(res[0].entryId).toBe("1");
      });

      it("behaves correctly when far more cards are due than the cap", () => {
        const items = Array.from({ length: 50 }, (_, i) => makeItem(`card-${i}`, -i, 0, `F${i % 3}`));
        const res = interleaveLane(items, 5);
        expect(res).toHaveLength(5);
      });
    });

    describe("interleaving constraint and single-family fallback", () => {
      it("prevents more than two consecutive items from the same pattern family", () => {
        const items = [
          makeItem("1", -1, 0, "Trees"),
          makeItem("2", -1, 0, "Trees"),
          makeItem("3", -1, 0, "Trees"),
          makeItem("4", -1, 0, "Arrays"),
          makeItem("5", -1, 0, "Trees"),
        ];
        const res = interleaveLane(items, 5);
        for (let i = 2; i < res.length; i++) {
          const sameThree = res[i].family === res[i - 1].family && res[i - 1].family === res[i - 2].family;
          expect(sameThree).toBe(false);
        }
      });

      it("falls back to sequential order when dominated by a single family and constraint cannot be satisfied", () => {
        const items = [
          makeItem("1", -5, 0, "Dominated"),
          makeItem("2", -4, 0, "Dominated"),
          makeItem("3", -3, 0, "Dominated"),
          makeItem("4", -2, 0, "Dominated"),
        ];
        const res = interleaveLane(items, 4);
        expect(res).toHaveLength(4);
        // Fallback takes candidateIndex 0 sequentially
        expect(res.map((r) => r.entryId)).toEqual(["1", "2", "3", "4"]);
      });
    });

    describe("interleaveQueue lane composition", () => {
      it("splits into RESOLVE lane first up to resolveCap and RECALL lane up to recallCap", () => {
        const cards: QueueItem[] = [
          makeItem("res-1", -1, 0, "F1", "RESOLVE"),
          makeItem("res-2", -1, 0, "F2", "RESOLVE"),
          makeItem("res-3", -1, 0, "F3", "RESOLVE"),
          makeItem("rec-1", -1, 0, "F1", "RECALL"),
          makeItem("rec-2", -1, 0, "F2", "RECALL"),
        ];
        const res = interleaveQueue(cards, 2, fixedNow, 6);
        expect(res).toHaveLength(4); // 2 resolve + 2 recall
        expect(res[0].lane).toBe("RESOLVE");
        expect(res[1].lane).toBe("RESOLVE");
        expect(res[2].lane).toBe("RECALL");
        expect(res[3].lane).toBe("RECALL");
      });

      it("handles empty queue gracefully", () => {
        expect(interleaveQueue([])).toEqual([]);
      });
    });
  });

  describe("spreadImportDueDates", () => {
    it("handles 0 entries", () => {
      const res = spreadImportDueDates([], fixedNow);
      expect(res).toEqual([]);
    });

    it("handles 1 entry placed on start date", () => {
      const res = spreadImportDueDates([{ id: "row-1", status: "SOLVED_UNAIDED", revisit: false }], fixedNow);
      expect(res).toHaveLength(1);
      expect(res[0].id).toBe("row-1");
      expect(res[0].due.toISOString()).toBe(fixedNow.toISOString());
      expect(res[0].seededRating).toBe("GOOD");
    });

    it("prioritizes revisit: true and SOLVED_WITH_HELP rows at the front", () => {
      const rows = [
        { id: "unaided", status: "SOLVED_UNAIDED" as const, revisit: false },
        { id: "revisit", status: "SOLVED_UNAIDED" as const, revisit: true },
        { id: "with_help", status: "SOLVED_WITH_HELP" as const, revisit: false },
      ];
      const res = spreadImportDueDates(rows, fixedNow);
      expect(res[0].id).toBe("revisit");
      expect(res[0].seededRating).toBe("AGAIN");
      expect(res[1].id).toBe("with_help");
      expect(res[1].seededRating).toBe("HARD");
      expect(res[2].id).toBe("unaided");
      expect(res[2].seededRating).toBe("GOOD");
    });

    it("spreads several hundred entries across the 60-day window monotonically", () => {
      const count = 300;
      const rows = Array.from({ length: count }, (_, i) => ({
        id: `row-${i}`,
        status: (i % 2 === 0 ? "SOLVED_UNAIDED" : "SOLVED_WITH_HELP") as any,
        revisit: i % 5 === 0,
      }));
      const res = spreadImportDueDates(rows, fixedNow);
      expect(res).toHaveLength(count);

      // Check monotonicity
      for (let i = 1; i < res.length; i++) {
        expect(res[i].due.getTime()).toBeGreaterThanOrEqual(res[i - 1].due.getTime());
      }

      // Check max spread within ~60 days
      const lastDue = res[res.length - 1].due;
      const maxExpectedTime = new Date(fixedNow);
      maxExpectedTime.setDate(maxExpectedTime.getDate() + 61);
      expect(lastDue.getTime()).toBeLessThanOrEqual(maxExpectedTime.getTime());
    });
  });
});
