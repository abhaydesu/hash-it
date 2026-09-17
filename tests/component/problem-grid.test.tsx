import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DataTable } from "@/components/problem-grid/data-table";
import { ProblemGridRow } from "@/components/problem-grid/columns";

// Mock server actions to prevent loading next-auth/next/server
vi.mock("@/app/actions/entry-actions", () => ({
  toggleRevisit: vi.fn(),
  deleteEntry: vi.fn(),
  updateEntryInline: vi.fn(),
}));

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
});
