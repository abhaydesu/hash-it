import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CommandBar } from "@/components/command-bar";

// Mock server actions
vi.mock("@/app/actions/settings-actions", () => ({
  getLogFormConfig: vi.fn().mockResolvedValue({ customFields: [], sources: [] }),
  addCustomField: vi.fn(),
}));

vi.mock("@/app/actions/entry-actions", () => ({
  createEntry: vi.fn(),
  deleteEntry: vi.fn(),
}));

// Mock fetch for the API route
global.fetch = vi.fn();

// The pattern picker fetches /api/patterns on mount, so mock by URL rather than call order.
function mockFetchByUrl(searchBody: unknown, patterns: string[] = []) {
  vi.mocked(global.fetch).mockImplementation((async (url: RequestInfo | URL) => ({
    ok: true,
    json: async () => (String(url).includes("/api/patterns") ? { patterns } : searchBody),
  })) as any);
}

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
    mockFetchByUrl({ results: mockResults, enrichment: null });

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
    mockFetchByUrl({ results: mockResults, enrichment: null });

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

  it("suggests existing patterns while typing a pattern tag and selects one on click", async () => {
    mockFetchByUrl({ results: [], enrichment: null }, ["Sliding Window", "Two Pointers"]);

    render(<CommandBar inline={true} />);
    await userEvent.type(screen.getByPlaceholderText(/Type problem number/i), "Unknown Problem xyz");
    await screen.findByText("Manual Problem Entry");

    const tagInput = screen.getByPlaceholderText(/Sliding Window, Strings/i);
    await userEvent.type(tagInput, "slidng win");

    const option = await screen.findByRole("option", { name: "Sliding Window" });
    await userEvent.click(within(option).getByRole("button"));

    expect(screen.getByRole("button", { name: "Remove Sliding Window" })).toBeInTheDocument();
    expect(screen.queryByRole("listbox", { name: "Existing patterns" })).not.toBeInTheDocument();
  });

  it("handles manual entry form if no results found", async () => {
    mockFetchByUrl({ results: [], enrichment: null });

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

  it("opens prefilled on the chosen catalog problem", async () => {
    render(<CommandBar inline={false} />);
    window.dispatchEvent(
      new CustomEvent("open-command-bar", {
        detail: {
          problem: {
            id: "prob-1",
            title: "Two Sum",
            url: "https://leetcode.com/problems/two-sum",
            difficulty: "EASY",
            patterns: [],
            topicTags: [],
          },
        },
      }),
    );

    expect(await screen.findByText("Two Sum")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("25")).toBeInTheDocument();
  });
});
