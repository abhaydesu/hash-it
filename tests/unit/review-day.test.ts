import { describe, expect, it } from "vitest";
import { monthlyStatus, reviewDay } from "@/lib/review-windows";

const TZ = "UTC";
const status = (now: Date, credited: string[]) => monthlyStatus(now, TZ, credited);

describe("reviewDay", () => {
  it("holds the queue on Sunday only for the weekly review", () => {
    const sunday = new Date("2026-10-11T12:00:00Z");
    const monday = new Date("2026-10-12T12:00:00Z");
    expect(reviewDay(sunday, TZ, status(sunday, ["2026-09"])).weekly).toBe(true);
    expect(reviewDay(monday, TZ, status(monday, ["2026-09"])).weekly).toBe(false);
  });

  it("holds the queue on the month's last day, not when overdue or first-time", () => {
    const last = new Date("2026-10-31T12:00:00Z");
    const after = new Date("2026-11-03T12:00:00Z");
    expect(reviewDay(last, TZ, status(last, ["2026-09"])).monthly).toBe(true);
    expect(reviewDay(after, TZ, status(after, ["2026-09"])).monthly).toBe(false);
    expect(reviewDay(last, TZ, status(last, [])).monthly).toBe(false);
  });
});
