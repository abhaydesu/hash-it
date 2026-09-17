import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { RecallCardItem } from "@/components/recall-card-item";
import { ReviewCardItem } from "@/components/review-card-item";

// Mock server actions
vi.mock("@/app/actions/entry-actions", () => ({
  recordRecallAttempt: vi.fn(),
  recordReviewAttempt: vi.fn(),
}));

describe("RecallCardItem", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockItem = {
    entryId: "entry-1",
    title: "Two Sum",
    number: 1,
    url: "https://leetcode.com/problems/two-sum",
    idea: "Use a hash map to store complements.",
  };

  it("renders correctly and requires approach to proceed", async () => {
    const onComplete = vi.fn();
    render(<RecallCardItem item={mockItem} onComplete={onComplete} />);

    expect(screen.getByText("Two Sum")).toBeInTheDocument();
    expect(screen.getByText("#1")).toBeInTheDocument();

    const button = screen.getByRole("button", { name: /check against notes/i });
    expect(button).toBeDisabled();

    const textarea = screen.getByPlaceholderText(/key idea, structure, edge cases…/i);
    fireEvent.change(textarea, { target: { value: "Hash map" } });

    expect(button).not.toBeDisabled();
    fireEvent.click(button);

    // After submit, shows the comparison view
    expect(screen.getByText("You wrote")).toBeInTheDocument();
    expect(screen.getByText("Hash map")).toBeInTheDocument();
    expect(screen.getByText("Your notes")).toBeInTheDocument();
    expect(screen.getByText("Use a hash map to store complements.")).toBeInTheDocument();
  });

  it("submits rating and calls onComplete", async () => {
    const { recordRecallAttempt } = await import("@/app/actions/entry-actions");
    vi.mocked(recordRecallAttempt).mockResolvedValue({ success: true, rating: "GOOD", nextDue: new Date() });
    vi.useFakeTimers();

    const onComplete = vi.fn();
    render(<RecallCardItem item={mockItem} onComplete={onComplete} />);

    const textarea = screen.getByPlaceholderText(/key idea, structure, edge cases…/i);
    fireEvent.change(textarea, { target: { value: "Hash map" } });
    fireEvent.click(screen.getByRole("button", { name: /check against notes/i }));

    const goodButton = screen.getByRole("button", { name: /matched/i });
    fireEvent.click(goodButton);

    expect(recordRecallAttempt).toHaveBeenCalledWith({
      entryId: "entry-1",
      rating: "GOOD",
      wroteApproach: "Hash map",
    });

    await vi.runAllTimersAsync();
    expect(onComplete).toHaveBeenCalled();
    vi.useRealTimers();
  });
});

describe("ReviewCardItem", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.alert = vi.fn(); // Mock alert
  });

  const mockItem = {
    entryId: "entry-1",
    problemId: "prob-1",
    title: "Two Sum",
    url: "https://leetcode.com/problems/two-sum",
    platform: "LEETCODE",
    lapses: 0,
    reps: 1,
  };

  it("renders correctly and requires minutes for SOLVED_UNAIDED", async () => {
    const onComplete = vi.fn();
    render(<ReviewCardItem item={mockItem} onComplete={onComplete} />);

    expect(screen.getByText("Two Sum")).toBeInTheDocument();

    const solvedColdButton = screen.getByRole("button", { name: /solved cold/i });
    fireEvent.click(solvedColdButton);

    expect(window.alert).toHaveBeenCalledWith("Please enter the minutes spent before marking a problem as solved.");
  });

  it("submits review successfully and shows next due info", async () => {
    const { recordReviewAttempt } = await import("@/app/actions/entry-actions");
    vi.mocked(recordReviewAttempt).mockResolvedValue({
      success: true,
      rating: "GOOD",
      nextDue: new Date("2026-09-18T12:00:00Z"), // 1 day later
    });
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-17T12:00:00Z"));

    const onComplete = vi.fn();
    render(<ReviewCardItem item={mockItem} onComplete={onComplete} />);

    const minutesInput = screen.getByPlaceholderText(/minutes taken/i);
    fireEvent.change(minutesInput, { target: { value: "15" } });

    const solvedColdButton = screen.getByRole("button", { name: /solved cold/i });
    fireEvent.click(solvedColdButton);

    expect(recordReviewAttempt).toHaveBeenCalledWith({
      entryId: "entry-1",
      status: "SOLVED_UNAIDED",
      minutes: 15,
      usedHint: false,
    });

    await vi.runAllTimersAsync();

    expect(screen.getByText(/next review in/i)).toBeInTheDocument();
    // It's 1 day diff
    expect(screen.getByText(/1 day/i)).toBeInTheDocument();
    expect(onComplete).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("renders alert for stuck problems", () => {
    render(
      <ReviewCardItem
        item={{ ...mockItem, lapses: 3, mistake: "Forgot to handle negative numbers" }}
        onComplete={vi.fn()}
      />
    );
    expect(screen.getByText("Stuck")).toBeInTheDocument();
    expect(screen.getByText("Forgot to handle negative numbers")).toBeInTheDocument();
  });
});
