"use client";

import { useState } from "react";
import {
  Upload,
  FileText,
  CheckCircle,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  Check,
  Sparkles,
  GitMerge,
  ExternalLink,
  Info,
  Maximize2,
  X,
  Wand2,
} from "lucide-react";
import {
  dryRunImportCSV,
  commitImportBatch,
  DryRunRow,
  DryRunSummary,
  DuplicateGroup,
  mergeTwoRows,
} from "@/app/actions/import-actions";
import { cn } from "@/lib/utils";

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [csvText, setCsvText] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [rows, setRows] = useState<DryRunRow[]>([]);
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([]);
  const [conflictStrategy, setConflictStrategy] = useState<"SKIP" | "OVERWRITE">("SKIP");
  const [error, setError] = useState<string | null>(null);
  const [committedCount, setCommittedCount] = useState<number | null>(null);
  const [selectedRowForDetail, setSelectedRowForDetail] = useState<DryRunRow | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        setCsvText(text);
      };
      reader.readAsText(selected);
    }
  };

  const handleDryRun = async () => {
    if (!csvText) return;
    setIsProcessing(true);
    setError(null);
    try {
      const summary = await dryRunImportCSV(csvText);
      setRows(summary.rows);
      setDuplicateGroups(summary.duplicateGroups);
    } catch (err) {
      setError(String(err));
    } finally {
      setIsProcessing(false);
    }
  };

  // 1-Click Fix for Mismatched Problem Link
  const handleApplySuggestedFix = (
    groupId: string,
    rowIndex: number,
    fix: DuplicateGroup["suggestedFixes"][0]
  ) => {
    const updatedRows = rows.map((r) => {
      if (r.rowIndex === rowIndex) {
        return {
          ...r,
          matchedProblemId: fix.suggestedProblemId,
          matchedTitle: fix.suggestedTitle,
          matchedNumber: fix.suggestedNumber,
          matchedPlatform: fix.suggestedPlatform,
          matchMethod: fix.suggestedMethod,
          isDuplicateInCSV: false,
          duplicateGroupId: undefined,
        };
      }
      return r;
    });

    setRows(updatedRows);

    // Remove fixed row from the group, or remove group entirely if only 1 row remains
    setDuplicateGroups((prev) =>
      prev
        .map((g) => {
          if (g.groupId === groupId) {
            const remainingRows = g.rows.filter((r) => r.rowIndex !== rowIndex);
            return {
              ...g,
              rows: remainingRows,
              suggestedFixes: g.suggestedFixes.filter((f) => f.rowIndex !== rowIndex),
            };
          }
          return g;
        })
        .filter((g) => g.rows.length > 1)
    );
  };

  // Merge Notes and attributes for genuine duplicate rows in a group
  const handleMergeGroupRows = (groupId: string) => {
    const group = duplicateGroups.find((g) => g.groupId === groupId);
    if (!group || group.rows.length < 2) return;

    const rowA = group.rows[0];
    const rowB = group.rows[1];
    const merged = mergeTwoRows(rowA, rowB);

    const updatedRows = rows
      .map((r) => (r.rowIndex === rowA.rowIndex ? merged : r))
      .filter((r) => r.rowIndex !== rowB.rowIndex);

    setRows(updatedRows);
    setDuplicateGroups((prev) => prev.filter((g) => g.groupId !== groupId));
  };

  // Keep specific row and discard the other
  const handleKeepRow = (groupId: string, keepRowIndex: number) => {
    const group = duplicateGroups.find((g) => g.groupId === groupId);
    if (!group) return;

    const discardRowIndices = new Set(
      group.rows.filter((r) => r.rowIndex !== keepRowIndex).map((r) => r.rowIndex)
    );

    const updatedRows = rows
      .filter((r) => !discardRowIndices.has(r.rowIndex))
      .map((r) => {
        if (r.rowIndex === keepRowIndex) {
          return { ...r, isDuplicateInCSV: false, duplicateGroupId: undefined };
        }
        return r;
      });

    setRows(updatedRows);
    setDuplicateGroups((prev) => prev.filter((g) => g.groupId !== groupId));
  };

  const handleCommit = async () => {
    if (rows.length === 0) return;
    setIsProcessing(true);
    setError(null);
    try {
      const result = await commitImportBatch({
        rows,
        filename: file?.name || "import.csv",
        conflictStrategy,
      });
      setCommittedCount(result.count);
    } catch (err) {
      setError(String(err));
    } finally {
      setIsProcessing(false);
    }
  };

  const matchedCatalogCount = rows.filter((r) => r.matchedProblemId).length;
  const newProblemsCount = rows.filter((r) => !r.matchedProblemId).length;
  const existingEntryConflictCount = rows.filter((r) => r.alreadyExistsInDB).length;
  const unresolvedDuplicateCount = duplicateGroups.length;

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in">
      {/* Header */}
      <div className="border-b border-zinc-800 pb-3">
        <div className="flex items-center gap-2 font-mono">
          <Upload className="h-4 w-4 text-emerald-400" />
          <h1 className="text-lg font-bold text-zinc-100 uppercase tracking-tight">
            SOLVED_SHEET_IMPORT_WORKFLOW
          </h1>
        </div>
        <p className="text-xs text-zinc-400 mt-1 font-sans">
          Migrate your personal 9-column solved-problems spreadsheet. Preserves all notes, ideas, mistakes, topics, and custom patterns. Interactive pre-commit duplicate resolution ensures no notes are lost.
        </p>
      </div>

      {committedCount != null ? (
        /* Success State */
        <div className="rounded-lg border border-emerald-800 bg-emerald-950/20 p-8 text-center space-y-4">
          <CheckCircle className="h-10 w-10 text-emerald-400 mx-auto" />
          <div className="space-y-1 font-mono">
            <h2 className="text-base font-bold text-emerald-300">Import Committed Successfully!</h2>
            <p className="text-xs text-zinc-400">
              Successfully ingested <span className="text-emerald-400 font-bold">{committedCount}</span> entries with preserved custom patterns and 21-day FSRS schedule spread.
            </p>
          </div>
          <div className="pt-2 flex justify-center gap-3 font-mono text-xs">
            <a
              href="/problems"
              className="rounded border border-emerald-700 bg-emerald-900/60 px-4 py-2 text-emerald-200 hover:bg-emerald-800 transition-colors"
            >
              Go to Problem Grid
            </a>
            <button
              onClick={() => {
                setCommittedCount(null);
                setRows([]);
                setDuplicateGroups([]);
                setFile(null);
                setCsvText("");
              }}
              className="rounded border border-zinc-800 bg-zinc-900 px-4 py-2 text-zinc-300 hover:bg-zinc-800"
            >
              Import Another File
            </button>
          </div>
        </div>
      ) : (
        /* Workflow Steps */
        <div className="space-y-6">
          {/* Step 1: File Upload */}
          <div className="border border-zinc-800 bg-zinc-950 rounded-lg p-5 space-y-4 font-mono">
            <div className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[10px]">
                1
              </span>
              Select Solved-Problems CSV File
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4">
              <label className="w-full sm:w-auto flex items-center justify-center gap-2 rounded border border-dashed border-zinc-700 bg-zinc-900/60 hover:bg-zinc-800 px-5 py-3 cursor-pointer text-xs text-zinc-300 transition-colors">
                <FileText className="h-4 w-4 text-emerald-400" />
                <span>{file ? file.name : "Choose .csv file..."}</span>
                <input type="file" accept=".csv" onChange={handleFileChange} className="hidden" />
              </label>

              {file && rows.length === 0 && (
                <button
                  onClick={handleDryRun}
                  disabled={isProcessing}
                  className="flex items-center gap-2 rounded border border-emerald-600 bg-emerald-600 hover:bg-emerald-500 px-5 py-3 text-xs font-semibold text-zinc-950 transition-colors disabled:opacity-50"
                >
                  {isProcessing ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <ArrowRight className="h-3.5 w-3.5" />
                  )}
                  Run Dry-Run Verification
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 text-[11px] font-mono text-zinc-400 pt-2 border-t border-zinc-900">
              <span className="text-zinc-500">1. Problem Name</span>
              <span className="text-zinc-500">2. Problem Link</span>
              <span className="text-zinc-500">3. Topic</span>
              <span className="text-zinc-500">4. Pattern</span>
              <span className="text-zinc-500">5. Idea</span>
              <span className="text-zinc-500">6. What I did wrong</span>
              <span className="text-zinc-500">7. Status</span>
              <span className="text-zinc-500">8. Revisit?</span>
              <span className="text-zinc-500">9. Source</span>
            </div>
          </div>

          {error && (
            <div className="rounded border border-rose-900 bg-rose-950/40 p-4 text-xs font-mono text-rose-300">
              {error}
            </div>
          )}

          {/* Step 2: Interactive Duplicate Resolution Panel (If any duplicates exist) */}
          {duplicateGroups.length > 0 && (
            <div className="rounded-lg border border-purple-800/80 bg-purple-950/20 p-5 space-y-4 font-mono">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-purple-300 font-bold text-xs">
                  <AlertTriangle className="h-4 w-4 text-purple-400" />
                  <span>PRE-COMMIT RESOLUTION: {duplicateGroups.length} CSV DUPLICATE GROUP(S) DETECTED</span>
                </div>
                <span className="text-[11px] text-zinc-400">
                  Resolve or merge these rows below so no personal notes are lost.
                </span>
              </div>

              <div className="space-y-4">
                {duplicateGroups.map((group, gIdx) => (
                  <div
                    key={group.groupId}
                    className="rounded border border-zinc-800 bg-zinc-900/90 p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                      <span className="text-xs font-semibold text-zinc-200">
                        Conflict Group #{gIdx + 1}: Target {group.matchedProblemTitle || group.matchedKey}
                      </span>
                      <div className="flex items-center gap-2">
                        {group.suggestedFixes.length === 0 && (
                          <button
                            onClick={() => handleMergeGroupRows(group.groupId)}
                            className="flex items-center gap-1.5 rounded bg-emerald-600 hover:bg-emerald-500 px-3 py-1 text-xs font-bold text-zinc-950 transition-colors"
                          >
                            <GitMerge className="h-3 w-3" />
                            Merge Both Rows (Combine Notes)
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Side-by-side comparison */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {group.rows.map((r, rIdx) => {
                        const fix = group.suggestedFixes.find((f) => f.rowIndex === r.rowIndex);

                        return (
                          <div
                            key={r.rowIndex}
                            className={cn(
                              "rounded border p-3 space-y-2 text-xs",
                              fix
                                ? "border-amber-700/60 bg-amber-950/20"
                                : "border-zinc-800 bg-zinc-950/60"
                            )}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-zinc-300">
                                Row #{r.rowIndex}: {r.rawName}
                              </span>
                              <button
                                onClick={() => handleKeepRow(group.groupId, r.rowIndex)}
                                className="text-[10px] text-zinc-400 hover:text-zinc-200 underline"
                              >
                                Keep this row only
                              </button>
                            </div>

                            <div className="text-[11px] text-zinc-400 truncate" title={r.rawLink}>
                              <span className="text-zinc-500">URL: </span>
                              {r.rawLink}
                            </div>

                            <div className="flex flex-wrap gap-2 text-[10px]">
                              {r.rawTopic && (
                                <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-zinc-300">
                                  Topic: {r.rawTopic}
                                </span>
                              )}
                              {r.rawPattern && (
                                <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-emerald-400">
                                  Pattern: {r.rawPattern}
                                </span>
                              )}
                              <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-sky-400">
                                Status: {r.parsedStatus}
                              </span>
                              {r.parsedRevisit && (
                                <span className="rounded bg-rose-950 border border-rose-800 px-1.5 py-0.5 text-rose-300">
                                  Revisit
                                </span>
                              )}
                            </div>

                            {/* Idea Preview */}
                            <div className="rounded bg-zinc-900 border border-zinc-800/80 p-2 text-[11px] text-zinc-300 max-h-20 overflow-y-auto">
                              <span className="text-[10px] text-zinc-500 uppercase font-semibold block">
                                Idea / Intuition:
                              </span>
                              {r.rawIdea || <span className="text-zinc-600 italic">None</span>}
                            </div>

                            {/* Mistake Preview */}
                            <div className="rounded bg-zinc-900 border border-zinc-800/80 p-2 text-[11px] text-zinc-300 max-h-20 overflow-y-auto">
                              <span className="text-[10px] text-zinc-500 uppercase font-semibold block">
                                What I did wrong:
                              </span>
                              {r.rawMistake || <span className="text-zinc-600 italic">None</span>}
                            </div>

                            {/* 1-Click Fix Button for Mismatched Links */}
                            {fix && (
                              <div className="pt-2 border-t border-amber-900/40">
                                <div className="text-[11px] text-amber-300 mb-2">
                                  ⚠️ {fix.reason}
                                </div>
                                <button
                                  onClick={() => handleApplySuggestedFix(group.groupId, r.rowIndex, fix)}
                                  className="w-full flex items-center justify-center gap-1.5 rounded border border-amber-600 bg-amber-600/20 hover:bg-amber-600 hover:text-zinc-950 px-3 py-1.5 text-xs font-bold text-amber-200 transition-colors"
                                >
                                  <Wand2 className="h-3.5 w-3.5" />
                                  Auto-Fix: Remap to #{fix.suggestedNumber} {fix.suggestedTitle}
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Dry-Run Summary & Preview Table */}
          {rows.length > 0 && (
            <div className="space-y-4 animate-in fade-in">
              {/* Summary Stats Cards */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 font-mono text-xs">
                <div className="rounded border border-zinc-800 bg-zinc-900/60 p-3">
                  <div className="text-zinc-500 text-[10px]">TOTAL ROWS</div>
                  <div className="text-base font-bold text-zinc-100 mt-0.5">{rows.length}</div>
                </div>
                <div className="rounded border border-emerald-900/50 bg-emerald-950/20 p-3">
                  <div className="text-emerald-500 text-[10px]">MATCHED TO CATALOG</div>
                  <div className="text-base font-bold text-emerald-400 mt-0.5">{matchedCatalogCount}</div>
                </div>
                <div className="rounded border border-sky-900/50 bg-sky-950/20 p-3">
                  <div className="text-sky-500 text-[10px]">NEW PROBLEMS TO CREATE</div>
                  <div className="text-base font-bold text-sky-400 mt-0.5">{newProblemsCount}</div>
                </div>
                <div className="rounded border border-amber-900/50 bg-amber-950/20 p-3">
                  <div className="text-amber-500 text-[10px]">EXISTING DB CONFLICTS</div>
                  <div className="text-base font-bold text-amber-400 mt-0.5">{existingEntryConflictCount}</div>
                </div>
                <div
                  className={cn(
                    "rounded border p-3",
                    unresolvedDuplicateCount > 0
                      ? "border-purple-800 bg-purple-950/30"
                      : "border-zinc-800 bg-zinc-900/60"
                  )}
                >
                  <div className="text-purple-400 text-[10px]">UNRESOLVED CSV DUPES</div>
                  <div className="text-base font-bold text-purple-300 mt-0.5">
                    {unresolvedDuplicateCount}
                  </div>
                </div>
              </div>

              {/* Database Conflict Strategy & Commit Section */}
              <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4 space-y-3 font-mono text-xs">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-zinc-800/80 pb-3">
                  <div>
                    <span className="text-zinc-300 font-semibold block">
                      Prior Database Conflict Strategy:
                    </span>
                    <span className="text-[11px] text-zinc-500">
                      Controls entries already logged in your database from previous imports (does not affect CSV duplicates).
                    </span>
                  </div>

                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-1.5 cursor-pointer text-zinc-300">
                      <input
                        type="radio"
                        name="conflictStrategy"
                        value="SKIP"
                        checked={conflictStrategy === "SKIP"}
                        onChange={() => setConflictStrategy("SKIP")}
                        className="accent-emerald-500"
                      />
                      <span>Skip Existing DB Entries</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer text-zinc-300">
                      <input
                        type="radio"
                        name="conflictStrategy"
                        value="OVERWRITE"
                        checked={conflictStrategy === "OVERWRITE"}
                        onChange={() => setConflictStrategy("OVERWRITE")}
                        className="accent-amber-500"
                      />
                      <span className="text-amber-300">Update / Overwrite Existing</span>
                    </label>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
                  <div className="text-xs text-zinc-400">
                    {unresolvedDuplicateCount > 0 ? (
                      <span className="text-purple-400 flex items-center gap-1">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Please resolve the {unresolvedDuplicateCount} duplicate conflict(s) above before committing.
                      </span>
                    ) : (
                      <span className="text-emerald-400 flex items-center gap-1">
                        <Check className="h-3.5 w-3.5" />
                        All rows verified and ready to commit. 100% data preservation guaranteed.
                      </span>
                    )}
                  </div>

                  <button
                    onClick={handleCommit}
                    disabled={isProcessing || unresolvedDuplicateCount > 0}
                    className="flex items-center gap-2 rounded border border-emerald-600 bg-emerald-600 hover:bg-emerald-500 px-6 py-2.5 text-xs font-bold text-zinc-950 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isProcessing ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Check className="h-3.5 w-3.5" />
                    )}
                    Commit {rows.length} Problems to Database
                  </button>
                </div>
              </div>

              {/* Table */}
              <div className="border border-zinc-800 rounded-lg overflow-hidden bg-zinc-950 font-mono text-xs">
                <div className="max-h-[550px] overflow-y-auto">
                  <table className="w-full text-left">
                    <thead className="sticky top-0 bg-zinc-900 border-b border-zinc-800 text-[10px] text-zinc-400 uppercase tracking-wider">
                      <tr>
                        <th className="py-2.5 px-3">#</th>
                        <th className="py-2.5 px-3">Raw Name</th>
                        <th className="py-2.5 px-3">Topic</th>
                        <th className="py-2.5 px-3">Pattern</th>
                        <th className="py-2.5 px-3">Idea</th>
                        <th className="py-2.5 px-3">What I Did Wrong</th>
                        <th className="py-2.5 px-3">Catalog Target</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Inspect</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/60">
                      {rows.map((row) => (
                        <tr
                          key={row.rowIndex}
                          onClick={() => setSelectedRowForDetail(row)}
                          className={cn(
                            "cursor-pointer transition-colors",
                            row.isDuplicateInCSV
                              ? "bg-purple-950/20 hover:bg-purple-950/30"
                              : row.alreadyExistsInDB
                              ? "bg-amber-950/10 hover:bg-amber-950/20"
                              : "hover:bg-zinc-900/40"
                          )}
                        >
                          <td className="py-2 px-3 text-zinc-500">{row.rowIndex}</td>
                          <td className="py-2 px-3 font-sans text-zinc-300 max-w-[180px] truncate" title={row.rawName}>
                            {row.rawName}
                          </td>
                          <td className="py-2 px-3 text-zinc-400 max-w-[100px] truncate" title={row.rawTopic}>
                            {row.rawTopic || "-"}
                          </td>
                          <td className="py-2 px-3">
                            {row.rawPattern ? (
                              <span className="rounded bg-zinc-900 border border-zinc-700 px-1.5 py-0.5 text-[10px] text-zinc-200">
                                {row.rawPattern}
                              </span>
                            ) : (
                              <span className="text-zinc-600">-</span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-zinc-400 max-w-[150px] truncate" title={row.rawIdea}>
                            {row.rawIdea || <span className="text-zinc-600">-</span>}
                          </td>
                          <td className="py-2 px-3 text-zinc-400 max-w-[150px] truncate" title={row.rawMistake}>
                            {row.rawMistake || <span className="text-zinc-600">-</span>}
                          </td>
                          <td className="py-2 px-3">
                            <span className="font-medium text-zinc-100 max-w-[200px] truncate block" title={row.matchedTitle}>
                              {row.matchedNumber != null ? `#${row.matchedNumber} ` : ""}
                              {row.matchedTitle}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-zinc-400">
                            {row.parsedStatus}
                          </td>
                          <td className="py-2 px-3">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedRowForDetail(row);
                              }}
                              className="rounded border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 p-1 text-zinc-400 hover:text-zinc-200"
                              title="Inspect full details"
                            >
                              <Maximize2 className="h-3 w-3" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Full Note & Detail Inspection Modal */}
          {selectedRowForDetail && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 font-mono animate-in fade-in">
              <div className="w-full max-w-2xl rounded-lg border border-zinc-800 bg-zinc-950 p-6 space-y-4 shadow-2xl">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                  <div>
                    <span className="text-xs text-zinc-500">ROW #{selectedRowForDetail.rowIndex}</span>
                    <h2 className="text-base font-bold text-zinc-100">{selectedRowForDetail.rawName}</h2>
                  </div>
                  <button
                    onClick={() => setSelectedRowForDetail(null)}
                    className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <span className="text-zinc-500 text-[10px] uppercase font-semibold block">Problem Link</span>
                    <a
                      href={selectedRowForDetail.rawLink}
                      target="_blank"
                      rel="noreferrer"
                      className="text-emerald-400 hover:underline flex items-center gap-1 mt-0.5"
                    >
                      {selectedRowForDetail.rawLink}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                    <div className="rounded bg-zinc-900 border border-zinc-800 p-2">
                      <span className="text-zinc-500 text-[10px] block">TOPIC</span>
                      <span className="text-zinc-200 font-semibold">{selectedRowForDetail.rawTopic || "-"}</span>
                    </div>
                    <div className="rounded bg-zinc-900 border border-zinc-800 p-2">
                      <span className="text-zinc-500 text-[10px] block">PATTERN</span>
                      <span className="text-emerald-400 font-semibold">{selectedRowForDetail.rawPattern || "-"}</span>
                    </div>
                    <div className="rounded bg-zinc-900 border border-zinc-800 p-2">
                      <span className="text-zinc-500 text-[10px] block">STATUS</span>
                      <span className="text-zinc-200 font-semibold">{selectedRowForDetail.parsedStatus}</span>
                    </div>
                    <div className="rounded bg-zinc-900 border border-zinc-800 p-2">
                      <span className="text-zinc-500 text-[10px] block">REVISIT?</span>
                      <span className="text-rose-400 font-semibold">{selectedRowForDetail.parsedRevisit ? "Yes" : "No"}</span>
                    </div>
                  </div>

                  <div>
                    <span className="text-emerald-400 text-[10px] uppercase font-semibold block mb-1">
                      Core Idea / Intuition Notes:
                    </span>
                    <div className="rounded bg-zinc-900 border border-zinc-800 p-3 text-zinc-200 whitespace-pre-wrap max-h-48 overflow-y-auto leading-relaxed">
                      {selectedRowForDetail.rawIdea || <span className="text-zinc-600 italic">No idea notes logged.</span>}
                    </div>
                  </div>

                  <div>
                    <span className="text-rose-400 text-[10px] uppercase font-semibold block mb-1">
                      What I Did Wrong / Trap Notes:
                    </span>
                    <div className="rounded bg-zinc-900 border border-zinc-800 p-3 text-zinc-200 whitespace-pre-wrap max-h-48 overflow-y-auto leading-relaxed">
                      {selectedRowForDetail.rawMistake || <span className="text-zinc-600 italic">No mistake notes logged.</span>}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => setSelectedRowForDetail(null)}
                    className="rounded border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 px-4 py-1.5 text-xs text-zinc-300"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
