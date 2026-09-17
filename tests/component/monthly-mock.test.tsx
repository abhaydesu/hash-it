import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MonthlyMockProvider, useMonthlyMock, MonthlyMockProblem } from "@/components/monthly-mock-provider";
import { MonthlyMockNavControls } from "@/components/monthly-mock-nav";

// Helper component to interact with context in tests
function TestComponent() {
  const { startSession, phase, elapsedSeconds, pause, resume, discard, isActive } = useMonthlyMock();

  const problems: MonthlyMockProblem[] = [
    {
      id: "p1",
      title: "Problem 1",
      number: 1,
      url: "https://example.com/1",
      platform: "LEETCODE",
      patternName: "Arrays",
      difficulty: "EASY",
    },
  ];

  return (
    <div>
      <div data-testid="phase">{phase}</div>
      <div data-testid="elapsed">{elapsedSeconds}</div>
      <div data-testid="active">{isActive.toString()}</div>
      <button onClick={() => startSession(problems)}>Start</button>
      <button onClick={pause}>Pause Context</button>
      <button onClick={resume}>Resume Context</button>
      <button onClick={discard}>Discard Context</button>
    </div>
  );
}

describe("MonthlyMockProvider and NavControls", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("provides context and formats clock", async () => {
    render(
      <MonthlyMockProvider>
        <TestComponent />
        <MonthlyMockNavControls />
      </MonthlyMockProvider>
    );

    // Initial state
    expect(screen.getByTestId("phase")).toHaveTextContent("idle");
    expect(screen.queryByTitle("Return to monthly mock")).not.toBeInTheDocument(); // Nav hidden when idle

    // Start
    await userEvent.click(screen.getByRole("button", { name: "Start" }));
    expect(screen.getByTestId("phase")).toHaveTextContent("running");
    
    // The nav should appear now
    const navLink = screen.getByTitle("Return to monthly mock");
    expect(navLink).toBeInTheDocument();
    
    // Check timer format
    expect(screen.getByText("00:00")).toBeInTheDocument();

    // Advance time
    act(() => {
      vi.advanceTimersByTime(65000); // 65 seconds
    });

    expect(screen.getByText("01:05")).toBeInTheDocument();
  });

  it("pauses and resumes from nav controls", async () => {
    render(
      <MonthlyMockProvider>
        <TestComponent />
        <MonthlyMockNavControls />
      </MonthlyMockProvider>
    );

    await userEvent.click(screen.getByRole("button", { name: "Start" }));
    
    act(() => {
      vi.advanceTimersByTime(10000); // 10s
    });
    
    expect(screen.getByText("00:10")).toBeInTheDocument();

    const pauseBtn = screen.getByRole("button", { name: "Pause mock" });
    await userEvent.click(pauseBtn);

    expect(screen.getByTestId("phase")).toHaveTextContent("paused");

    // Advance time while paused
    act(() => {
      vi.advanceTimersByTime(10000); // 10s
    });

    // Time shouldn't change
    expect(screen.getByText("00:10")).toBeInTheDocument();

    const resumeBtn = screen.getByRole("button", { name: "Resume mock" });
    await userEvent.click(resumeBtn);

    expect(screen.getByTestId("phase")).toHaveTextContent("running");

    act(() => {
      vi.advanceTimersByTime(2000); // 2s
    });

    expect(screen.getByText("00:12")).toBeInTheDocument();
  });

  it("can discard session via confirm dialog", async () => {
    render(
      <MonthlyMockProvider>
        <TestComponent />
        <MonthlyMockNavControls />
      </MonthlyMockProvider>
    );

    await userEvent.click(screen.getByRole("button", { name: "Start" }));
    expect(screen.getByTestId("active")).toHaveTextContent("true");

    const discardBtn = screen.getByRole("button", { name: "Discard mock" });
    await userEvent.click(discardBtn);

    // Confirm dialog appears
    const confirmDialogBtn = await screen.findByRole("button", { name: "Discard" });
    await userEvent.click(confirmDialogBtn);

    expect(screen.getByTestId("active")).toHaveTextContent("false");
    expect(screen.getByTestId("phase")).toHaveTextContent("idle");
  });
});
