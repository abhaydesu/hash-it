import { describe, expect, it } from "vitest";
import { getGreeting, firstName } from "@/lib/greeting";
import { weekRangeLabel } from "@/lib/dates";

describe("getGreeting", () => {
  // 2026-09-30T06:30Z is 12:00 in Asia/Kolkata and 06:30 in UTC.
  const now = new Date("2026-09-30T06:30:00Z");

  it("uses the user's timezone for the hour", () => {
    expect(getGreeting({ now, timezone: "Asia/Kolkata", name: "Abhay" })).toMatch(/[Aa]fternoon|Hey there/);
    expect(getGreeting({ now, timezone: "UTC", name: "Abhay" })).toMatch(/Up early|Early bird|Good morning/);
  });

  it("includes only the first name, and works without one", () => {
    expect(getGreeting({ now, timezone: "Asia/Kolkata", name: "Abhay Singh" })).toContain("Abhay");
    expect(getGreeting({ now, timezone: "Asia/Kolkata", name: "Abhay Singh" })).not.toContain("Singh");
    expect(getGreeting({ now, timezone: "Asia/Kolkata", name: null })).not.toContain(",");
  });

  it("is stable within a day and covers every hour", () => {
    expect(getGreeting({ now, timezone: "UTC" })).toBe(getGreeting({ now, timezone: "UTC" }));
    for (let h = 0; h < 24; h++) {
      const at = new Date(Date.UTC(2026, 8, 30, h));
      expect(getGreeting({ now: at, timezone: "UTC", name: "A" }).length).toBeGreaterThan(0);
    }
  });

  it("firstName handles blanks", () => {
    expect(firstName("  ")).toBeUndefined();
    expect(firstName(undefined)).toBeUndefined();
  });
});

describe("weekRangeLabel", () => {
  it("labels a week that crosses into the next month", () => {
    expect(weekRangeLabel("2026-09-28")).toBe("Week 4 of September, Sep 28 – Oct 4");
  });
  it("labels a week inside one month", () => {
    expect(weekRangeLabel("2026-09-07")).toBe("Week 1 of September, Sep 7 – 13");
    expect(weekRangeLabel("2026-09-14")).toBe("Week 2 of September, Sep 14 – 20");
  });
});
