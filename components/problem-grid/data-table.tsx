"use client";

import { useState, useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  flexRender,
  SortingState,
} from "@tanstack/react-table";
import { Download, Search, Filter, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
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

  // Export CSV matching Google Sheet columns per spec §6 and §9:
  // Problem Name, Problem Link, Topic, Pattern, Idea, What I did wrong, Status, Revisit?, Source
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
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 pb-3">
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
              className={`rounded px-2.5 py-1 text-xs font-mono font-medium transition-colors ${
                selectedView === tab.id
                  ? "bg-zinc-800 text-zinc-100 border border-zinc-700"
                  : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* CSV Export */}
        <button
          onClick={handleExportCsv}
          className="flex items-center gap-1.5 rounded border border-zinc-800 bg-zinc-900 px-3 py-1 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 transition-colors font-mono"
        >
          <Download className="h-3 w-3" />
          <span>Export CSV (Sheet Format)</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-4 md:grid-cols-5 text-xs font-mono">
        {/* Search */}
        <div className="relative sm:col-span-2">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-500" />
          <input
            type="text"
            placeholder="Search problems, ideas, mistakes..."
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="w-full rounded border border-zinc-800 bg-zinc-900/90 py-1.5 pl-8 pr-2.5 text-xs text-zinc-100 placeholder-zinc-500 focus:border-emerald-500/80 focus:outline-hidden"
          />
        </div>

        {/* Difficulty Filter */}
        <select
          value={difficultyFilter}
          onChange={(e) => setDifficultyFilter(e.target.value)}
          className="rounded border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-zinc-300 focus:border-zinc-700 focus:outline-hidden"
        >
          <option value="ALL">All Difficulties</option>
          <option value="EASY">Easy</option>
          <option value="MEDIUM">Medium</option>
          <option value="HARD">Hard</option>
        </select>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-zinc-300 focus:border-zinc-700 focus:outline-hidden"
        >
          <option value="ALL">All Statuses</option>
          <option value="SOLVED_UNAIDED">Unaided</option>
          <option value="SOLVED_WITH_HELP">With Help</option>
          <option value="ATTEMPTED_FAILED">Failed</option>
        </select>

        {/* Pattern Filter */}
        <select
          value={patternFilter}
          onChange={(e) => setPatternFilter(e.target.value)}
          className="rounded border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-zinc-300 focus:border-zinc-700 focus:outline-hidden"
        >
          <option value="ALL">All Patterns ({patternsList.length})</option>
          {patternsList.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>

      {/* Spreadsheet Table Container */}
      <div className="overflow-x-auto rounded-md border border-zinc-800/90 bg-zinc-950">
        <table className="w-full border-collapse text-left text-xs">
          <thead className="border-b border-zinc-800 bg-zinc-900/60 font-mono text-[11px] text-zinc-400">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    onClick={header.column.getToggleSortingHandler()}
                    className="cursor-pointer px-3 py-2 font-medium tracking-wider select-none hover:text-zinc-200"
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
          <tbody className="divide-y divide-zinc-900">
            {table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="hover:bg-zinc-900/50 transition-colors group"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-3 py-1.5 align-middle">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} className="py-8 text-center text-zinc-500 font-mono">
                  No problems match the current filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="flex items-center justify-between border-t border-zinc-900 pt-2 text-xs font-mono text-zinc-500">
        <div>
          Showing {table.getRowModel().rows.length} of {filteredData.length} records
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="flex items-center gap-1 rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-zinc-400 hover:text-zinc-200 disabled:opacity-30"
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
            className="flex items-center gap-1 rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-zinc-400 hover:text-zinc-200 disabled:opacity-30"
          >
            Next <ChevronRight className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
