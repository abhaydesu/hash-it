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
  getLoggedInfo: vi.fn().mockResolvedValue(null),
}));

const mockPathname = vi.fn(() => "/today");
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname(),
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
    const logButton = screen.getByRole("button", { name: /Log problem/i });
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
    await userEvent.click(await screen.findByRole("option", { name: /as a custom problem/i }));
    // Choosing a problem moves focus to the minutes field; wait for that before moving on.
    await waitFor(() => expect(screen.getByLabelText(/Time spent/i)).toHaveFocus());

    const tagInput = screen.getByPlaceholderText(/Sliding Window, Strings/i);
    await userEvent.type(tagInput, "slidng win");

    const option = await screen.findByRole("option", { name: "Sliding Window" });
    await userEvent.click(option);

    expect(screen.getByRole("button", { name: "Remove pattern Sliding Window" })).toBeInTheDocument();
    expect(screen.queryByRole("listbox", { name: /Pattern suggestions/ })).not.toBeInTheDocument();
  });

  it("handles manual entry form if no results found", async () => {
    mockFetchByUrl({ results: [], enrichment: null });

    const { createEntry } = await import("@/app/actions/entry-actions");
    vi.mocked(createEntry).mockResolvedValue({ success: true, entryId: "entry-123", isNew: true });

    render(<CommandBar inline={true} />);
    
    const input = screen.getByPlaceholderText(/Type problem number/i);
    await userEvent.type(input, "Unknown Problem xyz");

    // The last row offers a custom problem; Enter takes it
    expect(await screen.findByRole("option", { name: /as a custom problem/i })).toBeInTheDocument();
    await userEvent.type(input, "{Enter}");

    const titleInput = await screen.findByLabelText("Title");
    expect(titleInput).toHaveValue("Unknown Problem xyz");

    // Click Log Solve
    const logButton = screen.getByRole("button", { name: /Log problem/i });
    
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

  it("does not open with Cmd+K when on landing page or marketing paths", async () => {
    mockPathname.mockReturnValue("/");
    render(<CommandBar inline={false} />);

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true }));

    expect(screen.queryByPlaceholderText(/Type problem number/i)).not.toBeInTheDocument();
  });

  it("opens with Cmd+K when on dashboard route", async () => {
    mockPathname.mockReturnValue("/today");
    render(<CommandBar inline={false} />);

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true }));

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Type problem number/i)).toBeInTheDocument();
    });
  });

  it("navigates results with the arrow keys and selects with Enter", async () => {
    mockFetchByUrl({
      results: [
        { id: "p1", title: "Two Sum", url: "", difficulty: "EASY", patterns: [] },
        { id: "p2", title: "Three Sum", url: "", difficulty: "MEDIUM", patterns: [] },
      ],
      enrichment: null,
    });
    const { createEntry } = await import("@/app/actions/entry-actions");
    vi.mocked(createEntry).mockResolvedValue({ success: true, entryId: "entry-9", isNew: true });

    render(<CommandBar inline={true} />);
    const input = screen.getByRole("combobox", { name: /Search problems/i });
    await userEvent.type(input, "sum");
    await screen.findByRole("option", { name: /Two Sum/ });

    // First result is highlighted by default
    expect(screen.getByRole("option", { name: /Two Sum/ })).toHaveAttribute("aria-selected", "true");

    await userEvent.keyboard("{ArrowDown}");
    expect(screen.getByRole("option", { name: /Three Sum/ })).toHaveAttribute("aria-selected", "true");
    expect(input).toHaveAttribute("aria-activedescendant", "problem-option-1");

    await userEvent.keyboard("{Enter}");
    await userEvent.type(await screen.findByPlaceholderText("25"), "12");
    await userEvent.click(screen.getByRole("button", { name: /Log problem/i }));

    await waitFor(() => {
      expect(createEntry).toHaveBeenCalledWith(expect.objectContaining({ problemId: "p2", minutes: 12 }));
    });
  });

  it("shows the review wait for the chosen outcome and flag", async () => {
    const { getLogFormConfig } = await import("@/app/actions/settings-actions");
    vi.mocked(getLogFormConfig).mockResolvedValue({
      customFields: [],
      sources: [],
      firstIntervals: { cold: 14, hint: 10, solution: 7, flagged: 4 },
    });
    render(<CommandBar inline={false} />);
    window.dispatchEvent(
      new CustomEvent("open-command-bar", {
        detail: { problem: { id: "p1", title: "Two Sum", url: "", difficulty: "EASY", patterns: [], topicTags: [] } },
      }),
    );

    expect(await screen.findByText("14 days")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("radio", { name: /Saw solution/i }));
    expect(screen.getByText("7 days")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("switch", { name: /Revisit early/i }));
    expect(screen.getByText("4 days")).toBeInTheDocument();
  });

  it("asks for minutes inline instead of an alert when a solve has none", async () => {
    render(<CommandBar inline={false} />);
    window.dispatchEvent(
      new CustomEvent("open-command-bar", {
        detail: { problem: { id: "p1", title: "Two Sum", url: "", difficulty: "EASY", patterns: [], topicTags: [] } },
      }),
    );
    await userEvent.click(await screen.findByRole("button", { name: /Log problem/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/minutes/i);
  });

  it("recognises a pasted GeeksforGeeks link as a GfG problem, not a generic custom one", async () => {
    const url = "https://www.geeksforgeeks.org/problems/kadanes-algorithm-1587115620/1";
    mockFetchByUrl({
      results: [],
      enrichment: {
        title: "Kadane's Algorithm",
        slug: "kadanes-algorithm-1587115620",
        url,
        platform: "GFG",
        difficulty: "MEDIUM",
        topicTags: ["Arrays", "Dynamic Programming"],
        source: "gfg",
      },
    });
    const { createEntry } = await import("@/app/actions/entry-actions");
    vi.mocked(createEntry).mockResolvedValue({ success: true, entryId: "entry-gfg", isNew: true });

    render(<CommandBar inline={true} />);
    const input = screen.getByRole("combobox", { name: /Search problems/i });
    await userEvent.click(input);
    await userEvent.paste(url);

    const row = await screen.findByRole("option", { name: /Kadane's Algorithm/ });
    expect(row).toHaveTextContent("GeeksforGeeks");
    expect(screen.queryByText(/as a custom problem/i)).not.toBeInTheDocument();

    await userEvent.keyboard("{Enter}");
    expect(await screen.findByRole("heading", { name: "Kadane's Algorithm" })).toBeInTheDocument();
    expect(screen.queryByText("Custom problem")).not.toBeInTheDocument();

    await userEvent.type(await screen.findByPlaceholderText("25"), "20");
    await userEvent.click(screen.getByRole("button", { name: /Log problem/i }));
    await waitFor(() => {
      expect(createEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          manualTitle: "Kadane's Algorithm",
          manualUrl: url,
          manualPlatform: "GFG",
          manualDifficulty: "MEDIUM",
          manualTopicTags: ["Arrays", "Dynamic Programming"],
        }),
      );
    });
  });

  it("marks an already-logged problem in the results and in the form", async () => {
    const lastAt = new Date(Date.now() - 3 * 86_400_000).toISOString();
    const nextDue = new Date(Date.now() + 6 * 86_400_000 + 3_600_000).toISOString();
    mockFetchByUrl({
      results: [
        {
          id: "p1",
          title: "Two Sum",
          url: "",
          difficulty: "EASY",
          patterns: [],
          topicTags: [],
          logged: { entryId: "e1", status: "ATTEMPTED_FAILED", lastAt, nextDue },
        },
        { id: "p2", title: "Two Sum II", url: "", difficulty: "EASY", patterns: [], topicTags: [], logged: null },
      ],
      enrichment: null,
    });
    const { createEntry } = await import("@/app/actions/entry-actions");
    vi.mocked(createEntry).mockResolvedValue({ success: true, entryId: "e1", isNew: false });

    render(<CommandBar inline={true} />);
    await userEvent.type(screen.getByRole("combobox", { name: /Search problems/i }), "two sum");

    await screen.findByRole("option", { name: /Two Sum II/ });
    const logged = screen.getAllByRole("option")[0];
    expect(within(logged).getByText("Logged")).toBeInTheDocument();
    expect(within(screen.getByRole("option", { name: /Two Sum II/ })).queryByText("Logged")).not.toBeInTheDocument();

    await userEvent.keyboard("{Enter}");
    const banner = await screen.findByRole("status");
    expect(banner).toHaveTextContent("Already logged");
    expect(banner).toHaveTextContent("Saw solution 3 days ago");
    expect(banner).toHaveTextContent("due in 6 days");
    expect(screen.queryByText(/First review in/)).not.toBeInTheDocument();

    await userEvent.type(await screen.findByPlaceholderText("25"), "10");
    await userEvent.click(screen.getByRole("button", { name: "Log new attempt" }));
    await waitFor(() => expect(createEntry).toHaveBeenCalledWith(expect.objectContaining({ problemId: "p1" })));
  });

  it("looks up logged status when opened from another page", async () => {
    const { getLoggedInfo } = await import("@/app/actions/entry-actions");
    vi.mocked(getLoggedInfo).mockResolvedValue({
      entryId: "e1",
      status: "SOLVED_UNAIDED",
      lastAt: new Date().toISOString(),
      nextDue: null,
    });
    render(<CommandBar inline={false} />);
    window.dispatchEvent(
      new CustomEvent("open-command-bar", {
        detail: { problem: { id: "p1", title: "Two Sum", url: "", difficulty: "EASY", patterns: [], topicTags: [] } },
      }),
    );
    expect(await screen.findByText("Already logged")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Log new attempt" })).toBeInTheDocument();
  });
});
