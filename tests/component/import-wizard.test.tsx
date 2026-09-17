import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import ImportPage from "@/app/import/page";

// Mock server actions
vi.mock("@/app/actions/import-actions", () => ({
  dryRunImportCSV: vi.fn(),
  commitImportBatch: vi.fn(),
  mergeTwoRows: vi.fn((a, b) => ({ ...a, rawIdea: `${a.rawIdea}\n${b.rawIdea}` })),
}));

describe("ImportPage", () => {
  const originalFileReader = global.FileReader;

  beforeEach(() => {
    vi.clearAllMocks();
    class MockFileReader {
      onload: any = null;
      readAsText(file: any) {
        if (this.onload) {
          this.onload({ target: { result: "mock csv data" } });
        }
      }
    }
    global.FileReader = MockFileReader as any;
  });

  afterEach(() => {
    global.FileReader = originalFileReader;
  });

  it("renders file selection initially", () => {
    render(<ImportPage />);
    expect(screen.getByText("Choose .csv file...")).toBeInTheDocument();
  });

  it("runs dry run and displays row preview", async () => {
    const { dryRunImportCSV } = await import("@/app/actions/import-actions");
    vi.mocked(dryRunImportCSV).mockResolvedValue({
      rows: [
        {
          rowIndex: 1,
          rawName: "Two Sum",
          rawLink: "https://leetcode.com/problems/two-sum",
          rawTopic: "Algorithms",
          rawPattern: "Hash Map",
          rawIdea: "Use map",
          rawMistake: "",
          matchedProblemId: "prob-1",
          matchedTitle: "Two Sum",
          matchedNumber: 1,
          matchedPlatform: "LEETCODE",
          matchMethod: "URL_EXACT",
          parsedStatus: "SOLVED_UNAIDED",
          parsedRevisit: false,
          isDuplicateInCSV: false,
          alreadyExistsInDB: false,
        },
      ],
      duplicateGroups: [],
    } as any);

    render(<ImportPage />);

    // Upload file
    const file = new File(["dummy,csv,content"], "test.csv", { type: "text/csv" });
    const input = screen.getByLabelText(/choose \.csv file\.\.\./i, { selector: "input" });
    fireEvent.change(input, { target: { files: [file] } });

    // Click dry-run button
    const dryRunBtn = await screen.findByRole("button", { name: /run dry-run verification/i });
    fireEvent.click(dryRunBtn);

    await waitFor(() => {
      expect(dryRunImportCSV).toHaveBeenCalled();
      expect(screen.getByText("Total rows")).toBeInTheDocument();
      expect(screen.getByText("Commit 1 problems to database")).toBeInTheDocument();
    });
  });

  it("handles commit import batch", async () => {
    const { dryRunImportCSV, commitImportBatch } = await import("@/app/actions/import-actions");
    vi.mocked(dryRunImportCSV).mockResolvedValue({
      rows: [
        {
          rowIndex: 1,
          rawName: "Two Sum",
          rawLink: "https://leetcode.com/problems/two-sum",
          rawTopic: "Algorithms",
          rawPattern: "Hash Map",
          rawIdea: "Use map",
          rawMistake: "",
          matchedProblemId: "prob-1",
          matchedTitle: "Two Sum",
          matchedNumber: 1,
          matchedPlatform: "LEETCODE",
          matchMethod: "URL_EXACT",
          parsedStatus: "SOLVED_UNAIDED",
          parsedRevisit: false,
          isDuplicateInCSV: false,
          alreadyExistsInDB: false,
        },
      ],
      duplicateGroups: [],
    } as any);

    vi.mocked(commitImportBatch).mockResolvedValue({ count: 1 } as any);

    render(<ImportPage />);

    const file = new File(["dummy,csv,content"], "test.csv", { type: "text/csv" });
    const input = screen.getByLabelText(/choose \.csv file\.\.\./i, { selector: "input" });
    fireEvent.change(input, { target: { files: [file] } });

    const dryRunBtn = await screen.findByRole("button", { name: /run dry-run verification/i });
    fireEvent.click(dryRunBtn);

    const commitBtn = await screen.findByRole("button", { name: /commit 1 problems to database/i });
    fireEvent.click(commitBtn);

    await waitFor(() => {
      expect(commitImportBatch).toHaveBeenCalled();
      expect(screen.getByText("Import committed successfully")).toBeInTheDocument();
    });
  });
});
