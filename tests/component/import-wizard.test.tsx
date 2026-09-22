import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import ImportPage from "@/app/import/page";

vi.mock("@/app/actions/import-actions", () => ({
  dryRunImportCSV: vi.fn(),
  commitImportBatch: vi.fn(),
  mergeTwoRows: vi.fn((a, b) => ({ ...a, rawIdea: `${a.rawIdea}\n${b.rawIdea}` })),
}));

// Stub clipboard API for the PromptCopyPanel — jsdom doesn't ship one.
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn().mockResolvedValue(undefined),
  },
});

const sampleRow = {
  rowIndex: 1,
  rawName: "1. Two Sum",
  rawLink: "https://leetcode.com/problems/two-sum/",
  rawTopic: undefined,
  rawPattern: "HashMap",
  rawIdea: "Use hash for complement",
  rawMistake: undefined,
  rawSolvedDate: "2025-08-27",
  matchedProblemId: "prob-1",
  matchedTitle: "Two Sum",
  matchedNumber: 1,
  matchedPlatform: "LEETCODE",
  matchMethod: "NUMBER",
  parsedStatus: "SOLVED_UNAIDED",
  parsedRevisit: false,
  isDuplicateInCSV: false,
  alreadyExistsInDB: false,
} as const;

async function advanceToLoadPhase() {
  // Brief → Compose
  fireEvent.click(screen.getByRole("button", { name: /^start/i }));
  // Compose → Load
  fireEvent.click(await screen.findByRole("button", { name: /i have the csv/i }));
}

describe("ImportPage wizard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("opens on the brief phase with the intro headline", () => {
    render(<ImportPage />);
    expect(
      screen.getByRole("heading", { level: 2, name: /bring your leetcode history in/i })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^start/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /already have a csv/i })
    ).toBeInTheDocument();
  });

  it("routes through the wizard: brief → compose → load and disables Verify until CSV is present", async () => {
    render(<ImportPage />);
    await advanceToLoadPhase();

    // Paste mode is the default input tab on the load phase.
    const verifyBtn = await screen.findByRole("button", { name: /verify import/i });
    expect(verifyBtn).toBeDisabled();

    // Typing CSV text into the paste box enables it.
    const paste = screen.getByPlaceholderText(/paste the csv text here/i) as HTMLTextAreaElement;
    fireEvent.change(paste, {
      target: {
        value: "Problem Name,Problem Link\n\"1. Two Sum\",https://leetcode.com/problems/two-sum/",
      },
    });
    expect(verifyBtn).not.toBeDisabled();
  });

  it("warns when pasted CSV contains Gemini-style grounding artefacts", async () => {
    render(<ImportPage />);
    await advanceToLoadPhase();
    const paste = screen.getByPlaceholderText(/paste the csv text here/i) as HTMLTextAreaElement;

    fireEvent.change(paste, {
      target: {
        value:
          "Problem Name,Problem Link\n1. Two Sum,[https://leetcode.com/problems/two-sum/](https://www.google.com/search?q=two-sum&utm_source=gemini)",
      },
    });

    expect(
      await screen.findByText(/your llm injected citations or grounding/i)
    ).toBeInTheDocument();
  });

  it("advances to review after a successful dry-run and shows user-facing tile labels", async () => {
    const { dryRunImportCSV } = await import("@/app/actions/import-actions");
    vi.mocked(dryRunImportCSV).mockResolvedValue({
      totalRows: 1,
      matchedCatalogCount: 1,
      newProblemsCount: 0,
      existingEntryConflictCount: 0,
      duplicateInCSVCount: 0,
      rows: [sampleRow as never],
      duplicateGroups: [],
    } as never);

    render(<ImportPage />);
    await advanceToLoadPhase();

    const paste = screen.getByPlaceholderText(/paste the csv text here/i) as HTMLTextAreaElement;
    fireEvent.change(paste, {
      target: { value: "Problem Name\n\"1. Two Sum\"" },
    });
    fireEvent.click(screen.getByRole("button", { name: /verify import/i }));

    await waitFor(() => {
      expect(dryRunImportCSV).toHaveBeenCalled();
    });

    // Review phase tiles use user-facing labels (no "catalog").
    expect(await screen.findByText(/problems detected/i)).toBeInTheDocument();
    expect(screen.getByText(/new to add/i)).toBeInTheDocument();
    expect(screen.getByText(/already logged/i)).toBeInTheDocument();
    expect(screen.getByText(/needs your review/i)).toBeInTheDocument();
    expect(screen.queryByText(/matched to catalog/i)).not.toBeInTheDocument();
  });

  it("walks review → assign → confirm → commit and lands on the success screen", async () => {
    const { dryRunImportCSV, commitImportBatch } = await import("@/app/actions/import-actions");
    vi.mocked(dryRunImportCSV).mockResolvedValue({
      totalRows: 1,
      matchedCatalogCount: 1,
      newProblemsCount: 0,
      existingEntryConflictCount: 0,
      duplicateInCSVCount: 0,
      rows: [sampleRow as never],
      duplicateGroups: [],
    } as never);
    vi.mocked(commitImportBatch).mockResolvedValue({ count: 1 } as never);

    render(<ImportPage />);
    await advanceToLoadPhase();

    const paste = screen.getByPlaceholderText(/paste the csv text here/i) as HTMLTextAreaElement;
    fireEvent.change(paste, { target: { value: "Problem Name\n\"1. Two Sum\"" } });
    fireEvent.click(screen.getByRole("button", { name: /verify import/i }));

    // Review → Assign
    const reviewContinue = await screen.findByRole("button", { name: /^continue/i });
    fireEvent.click(reviewContinue);

    // Assign phase shows the scheduler-effect explainer.
    expect(await screen.findByText(/how this shapes your queue/i)).toBeInTheDocument();

    // Assign → Confirm
    const assignContinue = screen.getByRole("button", { name: /^continue/i });
    fireEvent.click(assignContinue);

    // Confirm → Commit
    const commitBtn = await screen.findByRole("button", { name: /commit 1 entries/i });
    fireEvent.click(commitBtn);

    await waitFor(() => {
      expect(commitImportBatch).toHaveBeenCalled();
    });

    // Success screen.
    expect(await screen.findByText(/^committed\.$/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /see your problems/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /import another/i })).toBeInTheDocument();
  });

  it("Skip-to-upload shortcut on the brief page jumps straight to the load phase", async () => {
    render(<ImportPage />);
    fireEvent.click(screen.getByRole("button", { name: /already have a csv/i }));
    expect(
      await screen.findByPlaceholderText(/paste the csv text here/i)
    ).toBeInTheDocument();
  });
});
