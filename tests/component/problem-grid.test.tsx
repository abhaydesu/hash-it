import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { DataTable } from "@/components/problem-grid/data-table";
import { ProblemGridRow } from "@/components/problem-grid/columns";
import { deleteCustomField, updateCustomField } from "@/app/actions/settings-actions";

// Mock server actions to prevent loading next-auth/next/server
vi.mock("@/app/actions/entry-actions", () => ({
  toggleRevisit: vi.fn(),
  deleteEntry: vi.fn(),
  updateEntryInline: vi.fn(),
}));
vi.mock("@/app/actions/settings-actions", () => ({
  addCustomField: vi.fn(),
  updateCustomField: vi.fn().mockResolvedValue([]),
  deleteCustomField: vi.fn().mockResolvedValue([]),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

describe("DataTable", () => {
  const mockData: ProblemGridRow[] = [
    {
      id: "entry-1",
      problemId: "prob-1",
      number: 1,
      title: "Two Sum",
      slug: "two-sum",
      url: "https://leetcode.com/problems/two-sum",
      platform: "LEETCODE",
      difficulty: "EASY",
      status: "SOLVED_UNAIDED",
      reps: 2,
      lapses: 0,
      due: new Date(Date.now() + 86400000).toISOString(),
      revisit: false,
      idea: "Hash map lookup",
      mistake: null,
      patterns: ["Hash Table", "Array"],
      topicTags: ["Array", "Hash Table"],
      firstSolvedAt: new Date().toISOString(),
    },
    {
      id: "entry-2",
      problemId: "prob-2",
      number: 2,
      title: "Add Two Numbers",
      slug: "add-two-numbers",
      url: "https://leetcode.com/problems/add-two-numbers",
      platform: "LEETCODE",
      difficulty: "MEDIUM",
      status: "SOLVED_WITH_HELP",
      reps: 1,
      lapses: 4, // leech
      due: new Date(Date.now() - 86400000).toISOString(), // overdue
      revisit: true,
      idea: "Linked list traversal",
      mistake: "Forgot carry over",
      patterns: ["Linked List"],
      topicTags: ["Linked List", "Math"],
      firstSolvedAt: new Date().toISOString(),
    },
  ];

  it("renders table with problem rows", () => {
    render(<DataTable data={mockData} patternsList={["Hash Table", "Array", "Linked List"]} />);
    
    expect(screen.getByText("Two Sum")).toBeInTheDocument();
    expect(screen.getByText("Add Two Numbers")).toBeInTheDocument();
  });

  it("filters problems by search text", () => {
    render(<DataTable data={mockData} patternsList={["Hash Table", "Array", "Linked List"]} />);
    
    const searchInput = screen.getByPlaceholderText(/search problems/i);
    fireEvent.change(searchInput, { target: { value: "Two Sum" } });

    expect(screen.getByText("Two Sum")).toBeInTheDocument();
    expect(screen.queryByText("Add Two Numbers")).not.toBeInTheDocument();
  });

  it("filters problems by preset view (Leech)", () => {
    render(<DataTable data={mockData} patternsList={["Hash Table", "Array", "Linked List"]} />);
    
    const leechButton = screen.getByRole("button", { name: /stuck/i });
    fireEvent.click(leechButton);

    expect(screen.queryByText("Two Sum")).not.toBeInTheDocument();
    expect(screen.getByText("Add Two Numbers")).toBeInTheDocument();
  });

  it("shows the user's columns and Source, without duplicating built-ins", () => {
    const rows: ProblemGridRow[] = mockData.map((r, i) => ({
      ...r,
      sourceList: i === 0 ? "Blind 75" : null,
      customValues: i === 0 ? { company: "Google" } : ({} as Record<string, string>),
    }));
    render(
      <DataTable
        data={rows}
        patternsList={[]}
        showSource
        customFields={[
          { id: "company", label: "Company", type: "text" },
          { id: "company_2", label: "company", type: "text" },
          { id: "difficulty_x", label: "Difficulty", type: "select" },
        ]}
      />
    );
    expect(screen.getAllByRole("columnheader", { name: /^company$/i })).toHaveLength(1);
    expect(screen.getByRole("columnheader", { name: "Source" })).toBeInTheDocument();
    expect(screen.getByText("Google")).toBeInTheDocument();
    expect(screen.getByText("Blind 75")).toBeInTheDocument();
  });

  it("header + opens the add-column form, not the log dialog", () => {
    const onLog = vi.fn();
    window.addEventListener("open-command-bar", onLog);
    render(<DataTable data={mockData} patternsList={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "Add column" }));
    expect(screen.getByLabelText("New field name")).toBeInTheDocument();
    expect(onLog).not.toHaveBeenCalled();
    window.removeEventListener("open-command-bar", onLog);
  });

  it("renames and deletes a custom column from its header menu", async () => {
    const fields = [{ id: "company", label: "Company", type: "text" as const }];
    render(<DataTable data={mockData} patternsList={[]} customFields={fields} />);

    fireEvent.click(screen.getByRole("button", { name: "Edit Company column" }));
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: "Company tag" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(updateCustomField).toHaveBeenCalledWith("company", { label: "Company tag" }));

    fireEvent.click(screen.getByRole("button", { name: "Edit Company column" }));
    fireEvent.click(screen.getByRole("button", { name: /delete$/i }));
    fireEvent.click(screen.getByRole("button", { name: "Delete column" }));
    await waitFor(() => expect(deleteCustomField).toHaveBeenCalledWith("company"));
  });
});
