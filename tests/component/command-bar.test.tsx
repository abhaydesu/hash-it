import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CommandBar } from "@/components/command-bar";

// Mock server actions
vi.mock("@/app/actions/settings-actions", () => ({
  getCustomFields: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/app/actions/entry-actions", () => ({
  createEntry: vi.fn(),
  deleteEntry: vi.fn(),
}));

// Mock fetch for the API route
global.fetch = vi.fn();

describe("CommandBar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ results: [], enrichment: null }),
    } as any);
  });

  it("opens on open-command-bar event", async () => {
    render(<CommandBar inline={false} />);
    
    expect(screen.queryByPlaceholderText(/Type problem number/i)).not.toBeInTheDocument();
    
    // Dispatch event
    window.dispatchEvent(new CustomEvent("open-command-bar"));
    
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Type problem number/i)).toBeInTheDocument();
    });
  });

  it("searches and displays results", async () => {
    const mockResults = [
      {
        id: "prob-1",
        title: "Two Sum",
        url: "https://leetcode.com/problems/two-sum",
        difficulty: "EASY",
        patterns: [{ name: "Hash Table" }],
      },
    ];
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ results: mockResults, enrichment: null }),
    } as any);

    render(<CommandBar inline={true} />);
    
    const input = screen.getByPlaceholderText(/Type problem number/i);
    await userEvent.type(input, "Two Sum");

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/search/problems", expect.any(Object));
      expect(screen.getByText("Two Sum")).toBeInTheDocument();
    });
  });

  it("allows selecting a problem and logging it", async () => {
    const mockResults = [
      {
        id: "prob-1",
        title: "Two Sum",
        url: "https://leetcode.com/problems/two-sum",
        difficulty: "EASY",
        patterns: [{ name: "Hash Table" }],
      },
    ];
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ results: mockResults, enrichment: null }),
    } as any);

    const { createEntry } = await import("@/app/actions/entry-actions");
    vi.mocked(createEntry).mockResolvedValue({ success: true, entryId: "entry-123", isNew: true });

    render(<CommandBar inline={true} />);
    
    // Type in search
    const input = screen.getByPlaceholderText(/Type problem number/i);
    await userEvent.type(input, "Two Sum");

    // Click the result
    const result = await screen.findByText("Two Sum");
    await userEvent.click(result);

    // Enter minutes
    const minutesInput = await screen.findByPlaceholderText("25");
    await userEvent.type(minutesInput, "15");

    // Click Log Solve
    const logButton = screen.getByRole("button", { name: /Log Solve/i });
    await userEvent.click(logButton);

    await waitFor(() => {
      expect(createEntry).toHaveBeenCalledWith(expect.objectContaining({
        problemId: "prob-1",
        minutes: 15,
        status: "SOLVED_UNAIDED",
      }));
    });

    // Check toast
    expect(await screen.findByText(/Logged/i)).toBeInTheDocument();
  });

  it("handles manual entry form if no results found", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ results: [], enrichment: null }),
    } as any);

    const { createEntry } = await import("@/app/actions/entry-actions");
    vi.mocked(createEntry).mockResolvedValue({ success: true, entryId: "entry-123", isNew: true });

    render(<CommandBar inline={true} />);
    
    const input = screen.getByPlaceholderText(/Type problem number/i);
    await userEvent.type(input, "Unknown Problem xyz");

    // Manual form appears
    const manualFormHeading = await screen.findByText("Manual Problem Entry");
    expect(manualFormHeading).toBeInTheDocument();

    const titleInput = screen.getByPlaceholderText("Title");
    expect(titleInput).toHaveValue("Unknown Problem xyz");

    // Click Log Solve
    const logButton = screen.getByRole("button", { name: /Log Solve/i });
    
    // We need minutes first
    const minutesInput = screen.getByPlaceholderText("25");
    await userEvent.type(minutesInput, "30");

    await userEvent.click(logButton);

    await waitFor(() => {
      expect(createEntry).toHaveBeenCalledWith(expect.objectContaining({
        manualTitle: "Unknown Problem xyz",
        minutes: 30,
        status: "SOLVED_UNAIDED",
      }));
    });
  });
});
