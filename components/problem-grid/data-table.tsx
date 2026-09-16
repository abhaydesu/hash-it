"use client";

import { useState, useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  flexRender,
  SortingState,
} from "@tanstack/react-table";
import { Download, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { columns, ProblemGridRow } from "./columns";
import Papa from "papaparse";

interface DataTableProps {
  data: ProblemGridRow[];
  patternsList: string[];
}

export function DataTable({ data, patternsList }: DataTableProps) {
  const [sorting, setSorting] = useState<SortingState>([{ id: "number", desc: false }]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [selectedView, setSelectedView] = useState<"ALL" | "REVISIT" | "LEECH" | "DUE" | "UNTAGGED">("ALL");
  const [difficultyFilter, setDifficultyFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [patternFilter, setPatternFilter] = useState<string>("ALL");

  // Filter data according to active presets & filters
  const filteredData = useMemo(() => {
    const now = Date.now();
    return data.filter((item) => {
      // Preset Views
      if (selectedView === "REVISIT" && !item.revisit) return false;
      if (selectedView === "LEECH" && item.lapses < 3) return false;
      if (selectedView === "UNTAGGED" && item.patterns.length > 0) return false;
      if (selectedView === "DUE") {
        if (!item.due) return false;
        if (new Date(item.due).getTime() > now) return false;
      }

      // Column Filters
      if (difficultyFilter !== "ALL" && item.difficulty !== difficultyFilter) return false;
      if (statusFilter !== "ALL" && item.status !== statusFilter) return false;
      if (patternFilter !== "ALL" && !item.patterns.includes(patternFilter)) return false;

      // Global Search Filter
      if (globalFilter.trim()) {
        const q = globalFilter.toLowerCase();
        const numStr = item.number != null ? `#${item.number}` : "";
        const titleMatch = item.title.toLowerCase().includes(q);
        const ideaMatch = item.idea?.toLowerCase().includes(q);
        const mistakeMatch = item.mistake?.toLowerCase().includes(q);
        const patternMatch = item.patterns.some((p) => p.toLowerCase().includes(q));
        if (!titleMatch && !numStr.includes(q) && !ideaMatch && !mistakeMatch && !patternMatch) {
          return false;
        }
      }

      return true;
    });
  }, [data, selectedView, difficultyFilter, statusFilter, patternFilter, globalFilter]);

  const table = useReactTable({
    data: filteredData,
    columns,
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: 50,
      },
    },
  });

  const handleExportCsv = () => {
    const csvRows = filteredData.map((row) => ({
      "Problem Name": row.number != null ? `${row.number}. ${row.title}` : row.title,
      "Problem Link": row.url,
      Topic: row.topicTags.join(", "),
      Pattern: row.patterns.join(", "),
      Idea: row.idea || "",
      "What I did wrong": row.mistake || "",
      Status:
        row.status === "SOLVED_UNAIDED"
          ? "Solved (No help)"
          : row.status === "SOLVED_WITH_HELP"
          ? "Solved (with help)"
          : "Attempted (Failed)",
      "Revisit?": row.revisit ? "Yes" : "No",
      Source: row.sourceList || "hash-it",
    }));

    const csv = Papa.unparse(csvRows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `problems-export-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-3 font-sans">
      {/* Top Controls: Preset Views & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
        {/* Preset Tabs */}
        <div className="flex items-center gap-1">
          {[
            { id: "ALL", label: `All (${data.length})` },
            { id: "DUE", label: "Due Today" },
            { id: "REVISIT", label: "Revisit Flagged" },
            { id: "LEECH", label: "Leeches (≥3)" },
            { id: "UNTAGGED", label: "Untagged" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedView(tab.id as any)}
              className={`rounded-none px-2.5 py-1 text-xs font-mono font-medium transition-colors border-b-2 ${
                selectedView === tab.id
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* CSV Export */}
        <button
          onClick={handleExportCsv}
          className="flex items-center gap-1.5 rounded-none border border-border bg-background px-3 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors font-mono"
        >
          <Download className="h-3 w-3" />
          <span>Export CSV (Sheet Format)</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-4 md:grid-cols-5 text-xs font-mono">
        {/* Search */}
        <div className="relative sm:col-span-2">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search problems, ideas, mistakes..."
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="w-full rounded-none border border-border bg-background py-1.5 pl-8 pr-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        {/* Difficulty Filter */}
        <select
          value={difficultyFilter}
          onChange={(e) => setDifficultyFilter(e.target.value)}
          className="rounded-none border border-border bg-background px-2.5 py-1.5 text-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="ALL">All difficulties</option>
          <option value="EASY">Easy</option>
          <option value="MEDIUM">Medium</option>
          <option value="HARD">Hard</option>
        </select>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-none border border-border bg-background px-2.5 py-1.5 text-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="ALL">All statuses</option>
          <option value="SOLVED_UNAIDED">Unaided</option>
          <option value="SOLVED_WITH_HELP">With help</option>
          <option value="ATTEMPTED_FAILED">Failed</option>
        </select>

        {/* Pattern Filter */}
        <select
          value={patternFilter}
          onChange={(e) => setPatternFilter(e.target.value)}
          className="rounded-none border border-border bg-background px-2.5 py-1.5 text-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="ALL">All patterns ({patternsList.length})</option>
          {patternsList.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>

      {/* Spreadsheet Table Container */}
      <div className="overflow-x-auto rounded-none border border-border bg-background">
        <table className="w-full border-collapse text-left text-xs">
          <thead className="border-b border-border bg-muted/40 font-mono text-[11px] text-muted-foreground">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    onClick={header.column.getToggleSortingHandler()}
                    className="cursor-pointer px-3 py-2 font-medium tracking-wider select-none hover:text-foreground border-r border-border last:border-r-0"
                  >
                    <div className="flex items-center gap-1">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getIsSorted() === "asc" && " ↑"}
                      {header.column.getIsSorted() === "desc" && " ↓"}
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-border">
            {table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="hover:bg-muted/50 transition-colors group"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-3 py-1.5 align-middle border-r border-border last:border-r-0">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} className="py-8 text-center text-muted-foreground font-mono">
                  No problems match the current filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="flex items-center justify-between border-t border-border pt-2 text-xs font-mono text-muted-foreground">
        <div>
          Showing {table.getRowModel().rows.length} of {filteredData.length} records
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="flex items-center gap-1 rounded-none border border-border bg-background px-2 py-1 hover:text-foreground disabled:opacity-50"
          >
            <ChevronLeft className="h-3 w-3" /> Prev
          </button>
          <span>
            Page {table.getState().pagination.pageIndex + 1} of{" "}
            {Math.max(1, table.getPageCount())}
          </span>
          <button
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="flex items-center gap-1 rounded-none border border-border bg-background px-2 py-1 hover:text-foreground disabled:opacity-50"
          >
            Next <ChevronRight className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
