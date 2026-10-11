import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { recordRecallCheck } = vi.hoisted(() => ({ recordRecallCheck: vi.fn() }));
vi.mock("@/app/actions/weekly-actions", () => ({ recordRecallCheck, commitWeeklyPlan: vi.fn() }));

vi.mock("@/components/weekly-plan-items", () => ({ WeeklyPlanItems: () => null }));

import { RecallCheckCard } from "@/components/weekly-review-client";
import type { RecallCheckItem } from "@/lib/weekly-review";

const item = {
  entryId: "e1",
  problemId: "p1",
  title: "Two Sum",
  number: 1,
  url: "https://leetcode.com/problems/two-sum",
  platform: "LEETCODE",
  difficulty: "EASY",
  reason: "stale",
  patterns: ["Hash Map"],
  idea: "Store complements",
  mistake: "Reusing the same index",
  retrievability: 0.5,
  result: null,
} as unknown as RecallCheckItem;

describe("RecallCheckCard", () => {
  beforeEach(() => recordRecallCheck.mockReset().mockResolvedValue(undefined));

  it("records Blank as a miss straight away, with no second question", async () => {
    const onAnswered = vi.fn();
    render(<RecallCheckCard item={item} onAnswered={onAnswered} />);
    await userEvent.click(screen.getByRole("button", { name: /Blank/ }));
    expect(screen.getByText("Store complements")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Matched" })).toBeNull();
    await waitFor(() =>
      expect(recordRecallCheck).toHaveBeenCalledWith({ entryId: "e1", confidence: "BLANK", recalled: false }),
    );
    expect(onAnswered).toHaveBeenCalledWith("e1", { confidence: "BLANK", recalled: false });
  });

  it.each([
    ["HAZY", "Matched", true],
    ["CLEAR", "Didn't match", false],
  ] as const)("asks Hazy/Clear to compare with notes (%s → %s)", async (confidence, button, recalled) => {
    const onAnswered = vi.fn();
    render(<RecallCheckCard item={item} onAnswered={onAnswered} />);
    await userEvent.click(screen.getByRole("button", { name: new RegExp(confidence === "HAZY" ? "Hazy" : "Clear") }));
    expect(recordRecallCheck).not.toHaveBeenCalled();
    expect(screen.getByText(/Did your recall match/)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: button }));
    await waitFor(() => expect(recordRecallCheck).toHaveBeenCalledWith({ entryId: "e1", confidence, recalled }));
    expect(onAnswered).toHaveBeenCalledWith("e1", { confidence, recalled });
  });

  it("offers a retry when saving a Blank fails", async () => {
    recordRecallCheck.mockRejectedValueOnce(new Error("boom"));
    render(<RecallCheckCard item={item} onAnswered={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /Blank/ }));
    await userEvent.click(await screen.findByRole("button", { name: "Retry" }));
    await waitFor(() => expect(recordRecallCheck).toHaveBeenCalledTimes(2));
  });

  it("shows the saved outcome wording", () => {
    render(
      <RecallCheckCard item={{ ...item, result: { confidence: "BLANK", recalled: false } }} onAnswered={vi.fn()} />,
    );
    expect(screen.getByText(/Nothing came back/)).toBeTruthy();
  });
});
