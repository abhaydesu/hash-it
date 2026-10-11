import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TodayClient, type TodayData } from "@/components/today-client";

vi.mock("@/components/ui/countdown", () => ({ Countdown: () => <span>soon</span> }));
vi.mock("@/components/recall-card-item", () => ({ RecallCardItem: () => null }));
vi.mock("@/components/review-card-item", () => ({ ReviewCardItem: () => null }));
vi.mock("@/components/import-prompt-banner", () => ({ ImportPromptBanner: () => null }));
vi.mock("@/components/weekly-plan-items", () => ({ WeeklyPlanItems: () => null }));

const base: TodayData = {
  queue: [],
  resolveCount: 0,
  recallCount: 0,
  doneToday: 0,
  snapshot: { totalEntries: 10, coldSolveRate: 0.5, totalAttempts: 4, leechCount: 0 },
  overdueCount: 0,
  greeting: "Good morning",
  reviewDay: { weekly: false, monthly: false },
  weeklyPlan: { items: null, upcoming: false, reviewDone: false, reviewOpen: false, nextReviewAt: 0 },
  monthlyStatus: { state: "locked", creditPeriod: "2026-10", opensAt: 0 },
  lastMock: null,
};

describe("TodayClient review day", () => {
  it("shows no banner on a normal day", () => {
    render(<TodayClient data={base} />);
    expect(screen.queryByText(/Review day/)).toBeNull();
    expect(screen.getByText("Nothing due today.")).toBeTruthy();
  });

  it("shows the weekly banner and replaces the queue message", () => {
    render(<TodayClient data={{ ...base, reviewDay: { weekly: true, monthly: false } }} />);
    expect(screen.getByText("Review day: weekly review")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Start weekly review/ }).getAttribute("href")).toBe("/review/weekly");
    expect(screen.getByText("No daily queue today.")).toBeTruthy();
  });

  it("names both reviews when they coincide", () => {
    render(<TodayClient data={{ ...base, reviewDay: { weekly: true, monthly: true } }} />);
    expect(screen.getByText("Review day: weekly review + monthly mock")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Start monthly mock/ }).getAttribute("href")).toBe("/review/monthly");
  });

  it("marks the weekly review done", () => {
    render(
      <TodayClient
        data={{ ...base, reviewDay: { weekly: true, monthly: false }, weeklyPlan: { ...base.weeklyPlan, reviewDone: true } }}
      />,
    );
    expect(screen.getByRole("link", { name: /Weekly review \(done\)/ })).toBeTruthy();
  });
});
