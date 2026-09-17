"use client";
import React from 'react';

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

const filterFieldClass =
  "h-8 w-full border border-border bg-background py-0 text-xs leading-8 text-foreground focus:outline-none focus:ring-2 focus:ring-orange-500";
const filterSelectClass = `${filterFieldClass} pl-2.5 pr-8`;

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
    const sanitize = (val: string) => {
      if (val && /^[=+\-@]/.test(val)) {
        return "'" + val;
      }
      return val;
    };

    const csvRows = filteredData.map((row) => ({
      "Problem Name": sanitize(row.number != null ? `${row.number}. ${row.title}` : row.title),
      "Problem Link": sanitize(row.url),
      Topic: sanitize(row.topicTags.join(", ")),
      Pattern: sanitize(row.patterns.join(", ")),
      Idea: sanitize(row.idea || ""),
      "What I did wrong": sanitize(row.mistake || ""),
      Status: sanitize(
        row.status === "SOLVED_UNAIDED"
          ? "Solved (No help)"
          : row.status === "SOLVED_WITH_HELP"
          ? "Solved (with help)"
          : "Attempted (Failed)"
      ),
      "Revisit?": sanitize(row.revisit ? "Yes" : "No"),
      Source: sanitize(row.sourceList || "hash-it"),
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
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
        <div className="flex flex-wrap items-center gap-1">
          {[
            { id: "ALL", label: `All (${data.length})` },
            { id: "DUE", label: "Due today" },
            { id: "REVISIT", label: "Revisit flagged" },
            { id: "LEECH", label: "Stuck (≥3)" },
            { id: "UNTAGGED", label: "Untagged" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedView(tab.id as any)}
              className={`border px-2.5 py-1 text-xs font-medium transition-colors ${
                selectedView === tab.id
                  ? "border-orange-500 bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400"
                  : "border-transparent text-muted-foreground hover:bg-muted/40 hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <button
          onClick={handleExportCsv}
          className="flex items-center gap-1.5 border border-border bg-background px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Download className="h-3 w-3" />
          <span>Export CSV</span>
        </button>
      </div>

      <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-4 md:grid-cols-5">
        <div className="relative sm:col-span-2">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search problems, ideas, mistakes…"
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className={`${filterFieldClass} pl-8 pr-2.5 placeholder:text-muted-foreground`}
          />
        </div>

        <select
          value={difficultyFilter}
          onChange={(e) => setDifficultyFilter(e.target.value)}
          className={filterSelectClass}
        >
          <option value="ALL">All difficulties</option>
          <option value="EASY">Easy</option>
          <option value="MEDIUM">Medium</option>
          <option value="HARD">Hard</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className={filterSelectClass}
        >
          <option value="ALL">All statuses</option>
          <option value="SOLVED_UNAIDED">Unaided</option>
          <option value="SOLVED_WITH_HELP">With help</option>
          <option value="ATTEMPTED_FAILED">Failed</option>
        </select>

        <select
          value={patternFilter}
          onChange={(e) => setPatternFilter(e.target.value)}
          className={filterSelectClass}
        >
          <option value="ALL">All patterns ({patternsList.length})</option>
          {patternsList.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto border border-border bg-background">
        <table className="w-full min-w-[1100px] table-fixed border-collapse text-left text-xs">
          <colgroup>
            {table.getAllLeafColumns().map((column) => (
              <col key={column.id} style={{ width: column.getSize() }} />
            ))}
          </colgroup>
          <thead className="sticky top-0 z-10 border-b border-border bg-muted/50 text-[11px] text-muted-foreground backdrop-blur-sm">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    onClick={header.column.getToggleSortingHandler()}
                    className="cursor-pointer select-none border-r border-border px-2.5 py-2 font-medium last:border-r-0 hover:text-foreground"
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
                <tr key={row.id} className="hover:bg-muted/40">
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className="border-r border-border px-2.5 py-1.5 align-middle last:border-r-0"
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} className="bg-dither-25 py-10 text-center text-muted-foreground">
                  No problems match the current filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between pt-1 text-xs text-muted-foreground">
        <div className="tabular-numbers">
          Showing {table.getRowModel().rows.length} of {filteredData.length} records
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="flex items-center gap-1 border border-border bg-background px-2 py-1 hover:text-foreground disabled:opacity-50"
          >
            <ChevronLeft className="h-3 w-3" /> Prev
          </button>
          <span className="tabular-numbers">
            Page {table.getState().pagination.pageIndex + 1} of {Math.max(1, table.getPageCount())}
          </span>
          <button
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="flex items-center gap-1 border border-border bg-background px-2 py-1 hover:text-foreground disabled:opacity-50"
          >
            Next <ChevronRight className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
