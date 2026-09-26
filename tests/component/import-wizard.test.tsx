import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import ImportPage from "@/app/import/page";

vi.mock("@/app/actions/import-actions", () => ({
  inspectImportCSV: vi.fn(),
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

/** A sheet with our name column, one existing custom field, and one new column. */
const sampleInspection = {
  rowCount: 1,
  existingFields: [{ id: "company", label: "Company", type: "text" }],
  columns: [
    { header: "Problem Name", samples: ["1. Two Sum"], filledCount: 1, suggestion: { kind: "builtin", key: "name" }, inferred: { type: "text" } },
    { header: "Company", samples: ["Google"], filledCount: 1, suggestion: { kind: "custom", fieldId: "company" }, inferred: { type: "text" } },
    { header: "Confidence", samples: ["4"], filledCount: 1, suggestion: null, inferred: { type: "number" } },
  ],
};

/** Load → Map columns → Verify (dry-run). */
async function continueThroughMapping() {
  const { inspectImportCSV } = await import("@/app/actions/import-actions");
  vi.mocked(inspectImportCSV).mockResolvedValue(sampleInspection as never);
  fireEvent.click(screen.getByRole("button", { name: /^continue/i }));
  expect(await screen.findByRole("heading", { name: /map your columns/i })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /verify import/i }));
}

async function advanceToLoadPhase() {
  // Brief → Compose (via the "From screenshots" pathway)
  fireEvent.click(screen.getByRole("button", { name: /from screenshots/i }));
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
      screen.getByRole("heading", { level: 2, name: /how do you want to import/i })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /from screenshots/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /upload a spreadsheet/i })
    ).toBeInTheDocument();
  });

  it("routes through the wizard: brief → compose → load and disables Continue until CSV is present", async () => {
    render(<ImportPage />);
    await advanceToLoadPhase();

    // Paste mode is the default input tab on the load phase.
    const verifyBtn = await screen.findByRole("button", { name: /^continue/i });
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
    await continueThroughMapping();

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
    await continueThroughMapping();

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
    // The mapped custom fields travel with the commit: existing one reused, new one created.
    expect(vi.mocked(commitImportBatch).mock.calls[0][0].customFields).toEqual([
      { id: "company", label: "Company", type: "text" },
      { id: "confidence", label: "Confidence", type: "number" },
    ]);

    // Success screen.
    expect(await screen.findByText(/^committed\.$/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /see your problems/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /import another/i })).toBeInTheDocument();
  });

  it("map step shows matched / new columns and sends the mapping to the dry-run", async () => {
    const { inspectImportCSV, dryRunImportCSV } = await import("@/app/actions/import-actions");
    vi.mocked(inspectImportCSV).mockResolvedValue(sampleInspection as never);
    vi.mocked(dryRunImportCSV).mockResolvedValue({
      totalRows: 1, matchedCatalogCount: 1, newProblemsCount: 0, existingEntryConflictCount: 0,
      duplicateInCSVCount: 0, rows: [sampleRow as never], duplicateGroups: [],
    } as never);

    render(<ImportPage />);
    await advanceToLoadPhase();
    fireEvent.change(screen.getByPlaceholderText(/paste the csv text here/i), {
      target: { value: "Problem Name,Company,Confidence\n1. Two Sum,Google,4" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^continue/i }));

    expect(await screen.findByRole("heading", { name: /map your columns/i })).toBeInTheDocument();
    expect(screen.getAllByText("Matches")).toHaveLength(2);
    expect(screen.getByText("New")).toBeInTheDocument();
    expect(screen.getByLabelText(/type for confidence/i)).toHaveValue("number");

    // Ignoring the only name column blocks the dry-run with a clear message.
    fireEvent.change(screen.getByLabelText(/import problem name as/i), { target: { value: "ignore" } });
    fireEvent.click(screen.getByRole("button", { name: /verify import/i }));
    expect(await screen.findByText(/map one of your columns to problem name/i)).toBeInTheDocument();
    expect(dryRunImportCSV).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(/import problem name as/i), { target: { value: "builtin:name" } });
    fireEvent.click(screen.getByRole("button", { name: /verify import/i }));
    await waitFor(() => expect(dryRunImportCSV).toHaveBeenCalled());
    expect(vi.mocked(dryRunImportCSV).mock.calls[0][1]).toEqual({
      "Problem Name": { kind: "builtin", key: "name" },
      Company: { kind: "custom", fieldId: "company" },
      Confidence: { kind: "custom", fieldId: "confidence" },
    });
  });

  it("Upload-a-spreadsheet on the brief page jumps straight to the load phase", async () => {
    render(<ImportPage />);
    fireEvent.click(screen.getByRole("button", { name: /upload a spreadsheet/i }));
    expect(
      await screen.findByText(/choose .csv file/i)
    ).toBeInTheDocument();
  });
});
