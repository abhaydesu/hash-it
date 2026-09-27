import { describe, it, expect } from "vitest";
import { computeStreak } from "@/lib/stats-engine";
import { readStatsPreferences, resolveSectionLayout } from "@/lib/stats-preferences";

describe("computeStreak", () => {
  it("returns zeros with no activity", () => {
    expect(computeStreak([], "2026-09-27", "2026-09-26")).toEqual({ current: 0, longest: 0, activeDays: 0, todayDone: false });
  });

  it("counts a run ending today", () => {
    const s = computeStreak(["2026-09-20", "2026-09-25", "2026-09-26", "2026-09-27"], "2026-09-27", "2026-09-26");
    expect(s).toEqual({ current: 3, longest: 3, activeDays: 4, todayDone: true });
  });

  it("keeps a run ending yesterday alive but not done today", () => {
    const s = computeStreak(["2026-09-25", "2026-09-26"], "2026-09-27", "2026-09-26");
    expect(s).toMatchObject({ current: 2, todayDone: false });
  });

  it("breaks the streak after a missed day but keeps the longest", () => {
    const s = computeStreak(["2026-09-01", "2026-09-02", "2026-09-03", "2026-09-25"], "2026-09-27", "2026-09-26");
    expect(s).toMatchObject({ current: 0, longest: 3 });
  });
});

describe("resolveSectionLayout", () => {
  const ids = ["a", "b", "c", "d"];

  it("shows everything in natural order by default", () => {
    expect(resolveSectionLayout(ids, { visibleSections: [], hiddenSections: [] }).map((r) => r.id)).toEqual(ids);
  });

  it("applies saved order, appends unseen sections, puts hidden last and drops stale ids", () => {
    const layout = resolveSectionLayout(ids, { visibleSections: ["c", "gone", "a"], hiddenSections: ["b"] });
    expect(layout).toEqual([
      { id: "c", visible: true },
      { id: "a", visible: true },
      { id: "d", visible: true },
      { id: "b", visible: false },
    ]);
  });

  it("falls back to defaults for malformed stored prefs", () => {
    expect(readStatsPreferences({ visibleSections: "nope" })).toEqual({ visibleSections: [], hiddenSections: [] });
  });
});
