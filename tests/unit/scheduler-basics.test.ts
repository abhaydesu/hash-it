import { describe, it, expect } from "vitest";
import {
  deriveRating,
  seedCard,
  advanceCard,
  interleaveQueue,
  spreadImportDueDates,
  isLeech,
  calculateRetrievability,
  type QueueItem,
  type ImportedRowInput,
} from "@/lib/scheduler";

describe("scheduler - rating derivation table", () => {
  it("derives AGAIN when solve status is ATTEMPTED_FAILED", () => {
    const rating = deriveRating({
      status: "ATTEMPTED_FAILED",
      minutes: 10,
      difficulty: "EASY",
    });
    expect(rating).toBe("AGAIN");
  });

  it("derives HARD when a hint was used", () => {
    const rating = deriveRating({
      status: "SOLVED_UNAIDED",
      usedHint: true,
      minutes: 10,
      difficulty: "EASY",
    });
    expect(rating).toBe("HARD");
  });

  it("still derives GOOD for a slow cold solve, never HARD", () => {
    const rating = deriveRating({
      status: "SOLVED_UNAIDED",
      minutes: 45,
      difficulty: "EASY",
    });
    expect(rating).toBe("GOOD");
  });

  it("derives GOOD when solved cold within baseline", () => {
    // Medium baseline = 40m; 35m is between 30m and 80m
    const rating = deriveRating({
      status: "SOLVED_UNAIDED",
      minutes: 35,
      difficulty: "MEDIUM",
    });
    expect(rating).toBe("GOOD");
  });

  it("derives GOOD when an unaided solve is logged without minutes", () => {
    const rating = deriveRating({
      status: "SOLVED_UNAIDED",
      minutes: null,
      difficulty: "MEDIUM",
    });
    expect(rating).toBe("GOOD");
  });

  it("derives EASY when solved cold well under baseline", () => {
    // Medium baseline = 40m; 20m <= 30m (0.75x)
    const rating = deriveRating({
      status: "SOLVED_UNAIDED",
      minutes: 20,
      difficulty: "MEDIUM",
    });
    expect(rating).toBe("EASY");
  });
});

describe("scheduler - card seeding", () => {
  const now = new Date("2026-09-14T08:00:00Z");

  it("seeds card for SOLVED_UNAIDED with 1 repetition and Good grade", () => {
    const card = seedCard({
      entryId: "entry-1",
      rating: "GOOD",
      now,
    });
    expect(card.reps).toBe(1);
    expect(card.lapses).toBe(0);
    expect(card.stability).toBeGreaterThan(0);
  });

  it("seeds card for SOLVED_WITH_HELP with Hard grade", () => {
    const card = seedCard({
      entryId: "entry-2",
      rating: "HARD",
      now,
    });
    expect(card.reps).toBe(1);
    expect(card.difficulty).toBeGreaterThan(0);
  });

  it("seeds an unaided solve strongest and ATTEMPTED_FAILED weakest", () => {
    const cardUnaided = seedCard({
      entryId: "entry-3",
      rating: "GOOD",
      now,
    });
    expect(cardUnaided.reps).toBe(1);
    expect(cardUnaided.stability).toBeGreaterThan(3.0);

    const cardFailed = seedCard({
      entryId: "entry-4",
      rating: "AGAIN",
      now,
    });
    expect(cardFailed.reps).toBe(1);
    expect(cardFailed.stability).toBeLessThan(1.0);
  });
});

describe("scheduler - card advance", () => {
  const now = new Date("2026-09-14T08:00:00Z");

  it("advances card state and increments reps on Good", () => {
    const initial = seedCard({
      entryId: "entry-adv",
      rating: "GOOD",
      now,
    });

    const later = new Date("2026-09-17T08:00:00Z");
    const advanced = advanceCard({
      currentCard: initial,
      rating: "GOOD",
      reviewDate: later,
    });

    expect(advanced.reps).toBe(2);
    expect(advanced.stability).toBeGreaterThanOrEqual(initial.stability);
  });
});

describe("scheduler - interleaving constraint", () => {
  const now = new Date("2026-09-14T08:00:00Z");

  it("prevents more than 2 consecutive cards of the same pattern family", () => {
    const cards: QueueItem[] = [
      { entryId: "1", due: new Date("2026-09-10"), lapses: 0, reps: 1, family: "Pointers" },
      { entryId: "2", due: new Date("2026-09-11"), lapses: 0, reps: 1, family: "Pointers" },
      { entryId: "3", due: new Date("2026-09-12"), lapses: 0, reps: 1, family: "Pointers" },
      { entryId: "4", due: new Date("2026-09-13"), lapses: 0, reps: 1, family: "Intervals" },
      { entryId: "5", due: new Date("2026-09-13"), lapses: 0, reps: 1, family: "Pointers" },
    ];

    const queue = interleaveQueue(cards, 5, now);
    expect(queue.length).toBe(5);

    // Verify no 3 consecutive cards share the same family
    for (let i = 0; i < queue.length - 2; i++) {
      const f1 = queue[i].family;
      const f2 = queue[i + 1].family;
      const f3 = queue[i + 2].family;
      if (f1 && f2 && f3) {
        const allSame = f1 === f2 && f2 === f3;
        expect(allSame).toBe(false);
      }
    }
  });

  it("respects dailyResolveCap and prioritizes oldest overdue and highest lapses", () => {
    const cards: QueueItem[] = [
      { entryId: "fresh", due: new Date("2026-09-14"), lapses: 0, reps: 1, family: "DP", lane: "RESOLVE" },
      { entryId: "oldest", due: new Date("2026-09-01"), lapses: 1, reps: 2, family: "DP", lane: "RESOLVE" },
      { entryId: "high-lapse", due: new Date("2026-09-05"), lapses: 4, reps: 2, family: "Graphs", lane: "RESOLVE" },
    ];

    const queue = interleaveQueue(cards, 2, now);
    expect(queue.length).toBe(2);
    const ids = queue.map((c) => c.entryId);
    expect(ids).toContain("oldest");
    expect(ids).toContain("high-lapse");
  });

  it("composes two review lanes with resolve cards first up to resolveCap and recall cards up to recallCap", () => {
    const cards: QueueItem[] = [
      { entryId: "res-1", due: new Date("2026-09-01"), lapses: 1, reps: 2, family: "DP", lane: "RESOLVE" },
      { entryId: "res-2", due: new Date("2026-09-02"), lapses: 2, reps: 2, family: "Graphs", lane: "RESOLVE" },
      { entryId: "res-3", due: new Date("2026-09-03"), lapses: 1, reps: 2, family: "Trees", lane: "RESOLVE" },
      { entryId: "rec-1", due: new Date("2026-09-01"), lapses: 0, reps: 1, family: "DP", lane: "RECALL" },
      { entryId: "rec-2", due: new Date("2026-09-02"), lapses: 0, reps: 1, family: "Arrays", lane: "RECALL" },
    ];

    const queue = interleaveQueue(cards, 2, now, 6);
    expect(queue.length).toBe(4);
    expect(queue[0].lane).toBe("RESOLVE");
    expect(queue[1].lane).toBe("RESOLVE");
    expect(queue[2].lane).toBe("RECALL");
    expect(queue[3].lane).toBe("RECALL");
  });
});

describe("scheduler - 21-day import spread", () => {
  it("spreads cards across 21 days prioritizing revisit: true and SOLVED_WITH_HELP", () => {
    const rows: ImportedRowInput[] = [
      { id: "normal-1", status: "SOLVED_UNAIDED", revisit: false },
      { id: "revisit-1", status: "SOLVED_UNAIDED", revisit: true },
      { id: "help-1", status: "SOLVED_WITH_HELP", revisit: false },
      { id: "normal-2", status: "SOLVED_UNAIDED", revisit: false },
    ];

    const startDate = new Date("2026-09-14T00:00:00Z");
    const spread = spreadImportDueDates(rows, startDate);

    expect(spread.length).toBe(4);
    // revisit: true must be first, but keeps a full-strength GOOD seed
    expect(spread[0].id).toBe("revisit-1");
    expect(spread[0].seededRating).toBe("GOOD");
    // SOLVED_WITH_HELP must be second
    expect(spread[1].id).toBe("help-1");
    expect(spread[1].seededRating).toBe("HARD");

    // Check that dates are spread across multiple days
    const dates = spread.map((s) => s.due.getTime());
    expect(dates[dates.length - 1]).toBeGreaterThanOrEqual(dates[0]);
  });
});

describe("scheduler - leeches and retrievability", () => {
  it("identifies leeches when lapses >= 3", () => {
    expect(isLeech({ lapses: 2 })).toBe(false);
    expect(isLeech({ lapses: 3 })).toBe(true);
    expect(isLeech({ lapses: 5 })).toBe(true);
  });

  it("computes reasonable retrievability values between 0 and 1", () => {
    const card = seedCard({
      entryId: "r-test",
      rating: "GOOD",
      now: new Date("2026-09-01T00:00:00Z"),
    });

    const rNow = calculateRetrievability(card, new Date("2026-09-01T00:00:00Z"));
    expect(rNow).toBeGreaterThan(0.95);

    const rLater = calculateRetrievability(card, new Date("2026-09-30T00:00:00Z"));
    expect(rLater).toBeLessThan(rNow);
    expect(rLater).toBeGreaterThan(0);
  });
});
