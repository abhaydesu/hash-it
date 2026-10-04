import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { WeeklyPlanItems } from "@/components/weekly-plan-items";
import type { PlanItemView } from "@/lib/weekly-review";

vi.mock("@/app/actions/entry-actions", () => ({
  recordReviewAttempt: vi.fn(),
}));

const redo: PlanItemView = {
  kind: "REDO",
  problemId: "stuck-id",
  entryId: "entry-stuck",
  title: "Stuck One",
  number: 1,
  url: "https://leetcode.com/problems/stuck-one",
  difficulty: "MEDIUM",
  done: false,
};

const fresh: PlanItemView = {
  kind: "FRESH",
  problemId: "fresh-id",
  entryId: null,
  title: "Fresh One",
  number: 2,
  url: "https://leetcode.com/problems/fresh-one",
  difficulty: "MEDIUM",
  done: false,
};

function renderProblem(item: PlanItemView) {
  return <span>{item.title}</span>;
}

describe("WeeklyPlanItems", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("records a redo with the same outcomes as Today", async () => {
    const { recordReviewAttempt } = await import("@/app/actions/entry-actions");
    vi.mocked(recordReviewAttempt).mockResolvedValue({
      success: true,
      rating: "GOOD",
      nextDue: new Date(),
    });

    render(<WeeklyPlanItems items={[redo]} renderProblem={renderProblem} />);

    fireEvent.click(screen.getByRole("button", { name: /solved cold/i }));
    expect(screen.getByText(/enter minutes spent/i)).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/minutes taken/i), { target: { value: "20" } });
    fireEvent.click(screen.getByRole("button", { name: /solved cold/i }));

    await waitFor(() => {
      expect(recordReviewAttempt).toHaveBeenCalledWith({
        entryId: "entry-stuck",
        status: "SOLVED_UNAIDED",
        minutes: 20,
        usedHint: false,
      });
    });
    expect(await screen.findByText("Done")).toBeInTheDocument();
  });

  it("opens the log dialog on the unseen problem", () => {
    const spy = vi.spyOn(window, "dispatchEvent");
    render(<WeeklyPlanItems items={[fresh]} renderProblem={renderProblem} />);

    fireEvent.click(screen.getByRole("button", { name: /^log$/i }));

    const event = spy.mock.calls.map((c) => c[0] as CustomEvent).find((e) => e.type === "open-command-bar");
    expect(event?.detail?.problem?.id).toBe("fresh-id");
    spy.mockRestore();
  });

  it("keeps compact redo collapsed until Record", () => {
    render(<WeeklyPlanItems items={[redo]} compact renderProblem={renderProblem} />);
    expect(screen.queryByRole("button", { name: /solved cold/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /record/i }));
    expect(screen.getByRole("button", { name: /solved cold/i })).toBeInTheDocument();
  });
});
