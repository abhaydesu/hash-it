import { describe, it, expect } from "vitest";
import {
  checkOutcome,
  pickLoggedCandidates,
  rankWeakPatterns,
  seededShuffle,
  selectRecallChecks,
  type CardFacts,
} from "@/lib/weekly-review";
import { addDays, addMonths, lastDayOfMonth, startOfLocalDay, startOfTomorrow, weekStart } from "@/lib/dates";
import { monthlyStatus, nextWeeklyReviewAt } from "@/lib/review-windows";
import { scheduledContests } from "@/lib/contests";

const card = (id: string, r: number, patterns: string[], extra: Partial<CardFacts> = {}): CardFacts => ({
  entryId: id,
  patterns,
  retrievability: r,
  lapses: 0,
  lastReview: new Date("2026-09-20T00:00:00Z"),
  lapsedThisWeek: false,
  ...extra,
});

describe("rankWeakPatterns", () => {
  it("ranks by the least-remembered problem, not the average", () => {
    const cards = [card("a1", 0.99, ["A"]), card("a2", 0.99, ["A"]), card("a3", 0.3, ["A"]), card("b1", 0.6, ["B"])];
    expect(rankWeakPatterns(cards, 0.8).map((p) => [p.name, p.weakest.entryId])).toEqual([
      ["A", "a3"],
      ["B", "b1"],
    ]);
  });
});

describe("selectRecallChecks", () => {
  it("orders forgotten → weakest per pattern → one stale, and keeps already-checked first", () => {
    const cards = [
      card("lapsed", 0.7, ["A"], { lapsedThisWeek: true }),
      card("weakA", 0.4, ["A"]),
      card("weakB", 0.5, ["B"]),
      card("fine", 0.95, ["C"], { lastReview: new Date("2026-01-01T00:00:00Z") }),
    ];
    const picks = selectRecallChecks(cards, { target: 0.8, alreadyChecked: ["weakB"] });
    expect(picks).toEqual([
      { entryId: "weakB", reason: "weak" },
      { entryId: "lapsed", reason: "lapsed" },
      { entryId: "weakA", reason: "weak" },
      { entryId: "fine", reason: "stale" },
    ]);
  });

  it("respects the limit", () => {
    const cards = Array.from({ length: 20 }, (_, i) => card(`c${i}`, 0.1, [`P${i}`], { lapsedThisWeek: true }));
    expect(selectRecallChecks(cards, { target: 0.8, alreadyChecked: [], limit: 8 })).toHaveLength(8);
  });
});

describe("checkOutcome", () => {
  it("never touches the schedule on a hit; flags sure-and-wrong", () => {
    expect(checkOutcome("CLEAR", true)).toEqual({ dueTomorrow: false, falseConfidence: false });
    expect(checkOutcome("HAZY", false)).toEqual({ dueTomorrow: true, falseConfidence: false });
    expect(checkOutcome("CLEAR", false)).toEqual({ dueTomorrow: true, falseConfidence: true });
  });
});

describe("plan candidates", () => {
  const now = new Date("2026-09-27T00:00:00Z");
  it("prefers stuck problems to redo and only old ones to revisit", () => {
    const cards = [
      card("stuck", 0.5, ["A"], { lapses: 4 }),
      card("lapsed", 0.3, ["A"], { lapses: 1 }),
      card("recent", 0.9, ["A"], { lastReview: new Date("2026-09-25T00:00:00Z") }),
      card("old", 0.9, ["A"], { lastReview: new Date("2026-06-01T00:00:00Z") }),
    ];
    const c = pickLoggedCandidates(cards, now, "seed");
    expect(c.REDO).toEqual(["stuck", "lapsed"]);
    expect(c.REVISIT).toEqual(["old"]);
  });

  it("shuffles deterministically per seed", () => {
    const items = Array.from({ length: 10 }, (_, i) => i);
    expect(seededShuffle(items, "w1")).toEqual(seededShuffle(items, "w1"));
    expect(seededShuffle(items, "w1").sort()).toEqual(items);
  });
});

describe("dates", () => {
  it("finds the local Monday", () => {
    // Sunday 27 Sep 2026, 20:00 UTC is already Monday 28 Sep in IST.
    expect(weekStart(new Date("2026-09-27T20:00:00Z"), "Asia/Kolkata")).toBe("2026-09-28");
    expect(weekStart(new Date("2026-09-27T20:00:00Z"), "America/New_York")).toBe("2026-09-21");
  });

  it("finds local midnight, including across DST", () => {
    expect(startOfLocalDay("2026-09-28", "Asia/Kolkata").toISOString()).toBe("2026-09-27T18:30:00.000Z");
    // US DST ends 1 Nov 2026: midnight on 2 Nov is EST (UTC-5).
    expect(startOfLocalDay("2026-11-02", "America/New_York").toISOString()).toBe("2026-11-02T05:00:00.000Z");
    expect(startOfTomorrow(new Date("2026-09-27T10:00:00Z"), "UTC").toISOString()).toBe("2026-09-28T00:00:00.000Z");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
});

describe("scheduledContests", () => {
  it("extrapolates the weekly and biweekly schedule", () => {
    const [first, second] = scheduledContests(new Date("2026-09-28T00:00:00Z"));
    expect(first).toMatchObject({ title: "Weekly Contest 522", startTime: Date.UTC(2026, 9, 4, 2, 30) });
    expect(second).toMatchObject({ title: "Biweekly Contest 193", startTime: Date.UTC(2026, 9, 10, 14, 30) });
  });

  it("keeps a running contest until it ends", () => {
    const [first] = scheduledContests(new Date(Date.UTC(2026, 9, 4, 3, 0)));
    expect(first.title).toBe("Weekly Contest 522");
    const [after] = scheduledContests(new Date(Date.UTC(2026, 9, 4, 4, 5)));
    expect(after.title).toBe("Biweekly Contest 193");
  });
});

describe("monthlyStatus", () => {
  const tz = "UTC";
  const at = (iso: string) => new Date(`${iso}T12:00:00Z`);

  it("opens the first mock any time, credited to this month", () => {
    expect(monthlyStatus(at("2026-09-10"), tz, [])).toEqual({ state: "first", creditPeriod: "2026-09" });
  });

  it("is due on the month's last day", () => {
    expect(monthlyStatus(at("2026-09-30"), tz, ["2026-08"])).toEqual({
      state: "open",
      creditPeriod: "2026-09",
      dueDay: "2026-09-30",
      overdue: false,
    });
  });

  it("stays open when missed, owing only the latest month", () => {
    // Last mock was June; July and August were missed. Only August is owed.
    expect(monthlyStatus(at("2026-09-10"), tz, ["2026-06"])).toEqual({
      state: "open",
      creditPeriod: "2026-08",
      dueDay: "2026-08-31",
      overdue: true,
    });
  });

  it("locks until the next month's last day once done", () => {
    const s = monthlyStatus(at("2026-09-10"), tz, ["2026-08"]);
    expect(s).toEqual({ state: "locked", creditPeriod: "2026-09", opensAt: Date.UTC(2026, 8, 30) });
    // Taking September's early pushes the next opening to October's last day.
    const after = monthlyStatus(at("2026-09-10"), tz, ["2026-08", "2026-09"]);
    expect(after).toMatchObject({ state: "locked", creditPeriod: "2026-10", opensAt: Date.UTC(2026, 9, 31) });
  });

  it("uses the user's timezone for the last day", () => {
    // 30 Sep 20:00 UTC is already 1 Oct in IST, so September's is overdue there.
    expect(monthlyStatus(new Date("2026-09-30T20:00:00Z"), "Asia/Kolkata", ["2026-08"])).toMatchObject({
      state: "open",
      creditPeriod: "2026-09",
      overdue: true,
    });
  });

  it("handles February and year ends", () => {
    expect(lastDayOfMonth("2028-02")).toBe("2028-02-29");
    expect(addMonths("2026-12", 1)).toBe("2027-01");
    expect(nextWeeklyReviewAt(new Date("2026-12-31T12:00:00Z"), "UTC")).toBe(Date.UTC(2027, 0, 4));
  });
});

describe("monthlyStatus after a first or early mock", () => {
  it("doesn't owe the previous month after a first mock credited to this month", () => {
    expect(monthlyStatus(new Date("2026-09-10T12:00:00Z"), "UTC", ["2026-09"])).toMatchObject({
      state: "locked",
      creditPeriod: "2026-10",
    });
  });
});
