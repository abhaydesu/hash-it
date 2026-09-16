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
  GitMerge,
  ExternalLink,
  Maximize2,
  X,
  Wand2,
} from "lucide-react";
import {
  dryRunImportCSV,
  commitImportBatch,
  DryRunRow,
  DuplicateGroup,
  mergeTwoRows,
} from "@/app/actions/import-actions";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SpecGrid, SpecCell } from "@/components/ui/spec-sheet";

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
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      {/* Header */}
      <div className="border-b border-border pb-6">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
          Import workflow
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Migrate your personal 9-column solved-problems spreadsheet. Preserves all notes, ideas, mistakes, topics, and custom patterns with pre-commit duplicate resolution.
        </p>
      </div>

      {committedCount != null ? (
        /* Success State */
        <div className="border border-border bg-background p-8 text-center space-y-4">
          <CheckCircle className="h-10 w-10 text-foreground mx-auto" />
          <div className="space-y-1">
            <h2 className="text-base font-bold text-foreground">Import committed successfully</h2>
            <p className="text-xs text-muted-foreground">
              Ingested <span className="text-foreground font-semibold tabular-nums">{committedCount}</span> entries with preserved custom patterns and 21-day FSRS schedule spread.
            </p>
          </div>
          <div className="pt-2 flex justify-center gap-3 text-xs">
            <Button
              variant="primary"
              onClick={() => {
                window.location.href = "/problems";
              }}
            >
              Go to problem grid
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setCommittedCount(null);
                setRows([]);
                setDuplicateGroups([]);
                setFile(null);
                setCsvText("");
              }}
            >
              Import another file
            </Button>
          </div>
        </div>
      ) : (
        /* Workflow Steps */
        <div className="space-y-8">
          {/* Step 1: File Upload */}
          <div className="border border-border bg-background p-5 sm:p-6 space-y-4">
            <div className="text-xs font-semibold text-foreground  tracking-wider flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center border border-border bg-muted text-[10px] font-mono text-muted-foreground">
                1
              </span>
              Select solved-problems CSV file
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4">
              <label className="w-full sm:w-auto flex items-center justify-center gap-2 border border-dashed border-border bg-background hover:bg-muted/40 px-5 py-3 cursor-pointer text-xs text-foreground transition-colors">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span>{file ? file.name : "Choose .csv file..."}</span>
                <input type="file" accept=".csv" onChange={handleFileChange} className="hidden" />
              </label>

              {file && rows.length === 0 && (
                <Button
                  variant="primary"
                  onClick={handleDryRun}
                  disabled={isProcessing}
                  className="w-full sm:w-auto text-xs"
                >
                  {isProcessing ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin mr-2" />
                  ) : (
                    <ArrowRight className="h-3.5 w-3.5 mr-2" />
                  )}
                  Run dry-run verification
                </Button>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 text-[11px] text-muted-foreground pt-3 border-t border-border">
              <span>1. Problem Name</span>
              <span>2. Problem Link</span>
              <span>3. Topic</span>
              <span>4. Pattern</span>
              <span>5. Idea</span>
              <span>6. What I did wrong</span>
              <span>7. Status</span>
              <span>8. Revisit?</span>
              <span>9. Source</span>
            </div>
          </div>

          {error && (
            <div className="border border-destructive/50 bg-destructive/10 p-4 text-xs font-mono text-destructive">
              {error}
            </div>
          )}

          {/* Step 2: Interactive Duplicate Resolution Panel (If any duplicates exist) */}
          {duplicateGroups.length > 0 && (
            <div className="border border-border bg-background p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-3">
                <div className="flex items-center gap-2 text-warning font-medium text-xs">
                  <AlertTriangle className="h-4 w-4" />
                  <span>Pre-commit resolution: {duplicateGroups.length} CSV duplicate group(s) detected</span>
                </div>
                <span className="text-[11px] text-muted-foreground">
                  Resolve or merge these rows below so no personal notes are lost.
                </span>
              </div>

              <div className="space-y-4">
                {duplicateGroups.map((group, gIdx) => (
                  <div
                    key={group.groupId}
                    className="border border-border bg-background p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between border-b border-border pb-2">
                      <span className="text-xs font-semibold text-foreground">
                        Conflict group #{gIdx + 1}: Target {group.matchedProblemTitle || group.matchedKey}
                      </span>
                      <div className="flex items-center gap-2">
                        {group.suggestedFixes.length === 0 && (
                          <Button
                            variant="secondary"
                            onClick={() => handleMergeGroupRows(group.groupId)}
                            className="text-xs h-7 px-3"
                          >
                            <GitMerge className="h-3 w-3 mr-1.5" />
                            Merge both rows (combine notes)
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Side-by-side comparison */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {group.rows.map((r) => {
                        const fix = group.suggestedFixes.find((f) => f.rowIndex === r.rowIndex);

                        return (
                          <div
                            key={r.rowIndex}
                            className={cn(
                              "border p-3 space-y-2 text-xs",
                              fix
                                ? "border-warning/50 bg-warning/5"
                                : "border-border bg-muted/20"
                            )}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-foreground">
                                Row #{r.rowIndex}: {r.rawName}
                              </span>
                              <button
                                onClick={() => handleKeepRow(group.groupId, r.rowIndex)}
                                className="text-[10px] text-muted-foreground hover:text-foreground underline underline-offset-2"
                              >
                                Keep this row only
                              </button>
                            </div>

                            <div className="text-[11px] text-muted-foreground truncate" title={r.rawLink}>
                              <span className="text-muted-foreground/70">URL: </span>
                              {r.rawLink}
                            </div>

                            <div className="flex flex-wrap gap-2 text-[10px]">
                              {r.rawTopic && (
                                <Badge variant="secondary">
                                  Topic: {r.rawTopic}
                                </Badge>
                              )}
                              {r.rawPattern && (
                                <Badge variant="outline">
                                  Pattern: {r.rawPattern}
                                </Badge>
                              )}
                              <Badge variant="outline">
                                Status: {r.parsedStatus}
                              </Badge>
                              {r.parsedRevisit && (
                                <Badge variant="failed">
                                  Revisit
                                </Badge>
                              )}
                            </div>

                            {/* Idea Preview */}
                            <div className="bg-background border border-border p-2 text-[11px] text-foreground max-h-20 overflow-y-auto">
                              <span className="text-[10px] text-muted-foreground  font-semibold block">
                                Idea / intuition:
                              </span>
                              {r.rawIdea || <span className="text-muted-foreground italic">None</span>}
                            </div>

                            {/* Mistake Preview */}
                            <div className="bg-background border border-border p-2 text-[11px] text-foreground max-h-20 overflow-y-auto">
                              <span className="text-[10px] text-muted-foreground  font-semibold block">
                                What I did wrong:
                              </span>
                              {r.rawMistake || <span className="text-muted-foreground italic">None</span>}
                            </div>

                            {/* 1-Click Fix Button for Mismatched Links */}
                            {fix && (
                              <div className="pt-2 border-t border-border">
                                <div className="text-[11px] text-warning mb-2">
                                  ⚠️ {fix.reason}
                                </div>
                                <Button
                                  variant="secondary"
                                  onClick={() => handleApplySuggestedFix(group.groupId, r.rowIndex, fix)}
                                  className="w-full text-xs justify-center"
                                >
                                  <Wand2 className="h-3.5 w-3.5 mr-1.5" />
                                  Auto-fix: Remap to #{fix.suggestedNumber} {fix.suggestedTitle}
                                </Button>
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
            <div className="space-y-6">
              {/* Summary Stats Cards using SpecGrid */}
              <SpecGrid columns={5}>
                <SpecCell label="TOTAL ROWS" value={rows.length} />
                <SpecCell label="MATCHED TO CATALOG" value={matchedCatalogCount} />
                <SpecCell label="NEW PROBLEMS" value={newProblemsCount} />
                <SpecCell label="DB CONFLICTS" value={existingEntryConflictCount} />
                <SpecCell
                  label="UNRESOLVED DUPES"
                  value={unresolvedDuplicateCount}
                  className={unresolvedDuplicateCount > 0 ? "text-warning" : ""}
                />
              </SpecGrid>

              {/* Database Conflict Strategy & Commit Section */}
              <div className="border border-border bg-background p-4 sm:p-5 space-y-4 text-xs">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-border pb-3">
                  <div>
                    <span className="text-foreground font-semibold block">
                      Prior database conflict strategy
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      Controls entries already logged in your database from previous imports (does not affect CSV duplicates).
                    </span>
                  </div>

                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer text-foreground">
                      <input
                        type="radio"
                        name="conflictStrategy"
                        value="SKIP"
                        checked={conflictStrategy === "SKIP"}
                        onChange={() => setConflictStrategy("SKIP")}
                        className="accent-foreground"
                      />
                      <span>Skip existing DB entries</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer text-foreground">
                      <input
                        type="radio"
                        name="conflictStrategy"
                        value="OVERWRITE"
                        checked={conflictStrategy === "OVERWRITE"}
                        onChange={() => setConflictStrategy("OVERWRITE")}
                        className="accent-foreground"
                      />
                      <span>Update / overwrite existing</span>
                    </label>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
                  <div className="text-xs text-muted-foreground">
                    {unresolvedDuplicateCount > 0 ? (
                      <span className="text-warning flex items-center gap-1.5">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Please resolve the {unresolvedDuplicateCount} duplicate conflict(s) above before committing.
                      </span>
                    ) : (
                      <span className="text-foreground flex items-center gap-1.5">
                        <Check className="h-3.5 w-3.5 text-easy" />
                        All rows verified and ready to commit. 100% data preservation guaranteed.
                      </span>
                    )}
                  </div>

                  <Button
                    variant="primary"
                    onClick={handleCommit}
                    disabled={isProcessing || unresolvedDuplicateCount > 0}
                    className="w-full sm:w-auto text-xs"
                  >
                    {isProcessing ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin mr-2" />
                    ) : (
                      <Check className="h-3.5 w-3.5 mr-2" />
                    )}
                    Commit {rows.length} problems to database
                  </Button>
                </div>
              </div>

              {/* Table */}
              <div className="border border-border bg-background text-xs overflow-hidden">
                <div className="max-h-[550px] overflow-y-auto">
                  <table className="w-full text-left">
                    <thead className="sticky top-0 bg-muted/40 border-b border-border text-[10px] font-mono text-muted-foreground  tracking-wider">
                      <tr>
                        <th className="py-2.5 px-3">#</th>
                        <th className="py-2.5 px-3">Raw name</th>
                        <th className="py-2.5 px-3">Topic</th>
                        <th className="py-2.5 px-3">Pattern</th>
                        <th className="py-2.5 px-3">Idea</th>
                        <th className="py-2.5 px-3">What I did wrong</th>
                        <th className="py-2.5 px-3">Catalog target</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Inspect</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {rows.map((row) => (
                        <tr
                          key={row.rowIndex}
                          onClick={() => setSelectedRowForDetail(row)}
                          className={cn(
                            "cursor-pointer transition-colors",
                            row.isDuplicateInCSV
                              ? "bg-warning/10 hover:bg-warning/15"
                              : row.alreadyExistsInDB
                              ? "bg-muted/40 hover:bg-muted/60"
                              : "hover:bg-muted/30"
                          )}
                        >
                          <td className="py-2 px-3 text-muted-foreground font-mono">{row.rowIndex}</td>
                          <td className="py-2 px-3 text-foreground font-medium max-w-[180px] truncate" title={row.rawName}>
                            {row.rawName}
                          </td>
                          <td className="py-2 px-3 text-muted-foreground max-w-[100px] truncate" title={row.rawTopic}>
                            {row.rawTopic || "-"}
                          </td>
                          <td className="py-2 px-3">
                            {row.rawPattern ? (
                              <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-normal">
                                {row.rawPattern}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground/60">-</span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-muted-foreground max-w-[150px] truncate" title={row.rawIdea}>
                            {row.rawIdea || <span className="text-muted-foreground/60">-</span>}
                          </td>
                          <td className="py-2 px-3 text-muted-foreground max-w-[150px] truncate" title={row.rawMistake}>
                            {row.rawMistake || <span className="text-muted-foreground/60">-</span>}
                          </td>
                          <td className="py-2 px-3">
                            <span className="font-medium text-foreground max-w-[200px] truncate block" title={row.matchedTitle}>
                              {row.matchedNumber != null ? `#${row.matchedNumber} ` : ""}
                              {row.matchedTitle}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-muted-foreground font-mono text-[11px]">
                            {row.parsedStatus}
                          </td>
                          <td className="py-2 px-3">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedRowForDetail(row);
                              }}
                              className="border border-border bg-background hover:bg-muted p-1 text-muted-foreground hover:text-foreground transition-colors"
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
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in">
              <div className="w-full max-w-2xl border border-border bg-background p-6 space-y-4 shadow-xl">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <div>
                    <span className="text-[11px] font-mono  tracking-wider text-muted-foreground">
                      Row #{selectedRowForDetail.rowIndex}
                    </span>
                    <h2 className="text-base font-bold text-foreground">{selectedRowForDetail.rawName}</h2>
                  </div>
                  <button
                    onClick={() => setSelectedRowForDetail(null)}
                    className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="space-y-4 text-xs">
                  <div>
                    <span className="text-muted-foreground text-[10px] font-mono  tracking-wider block mb-1">
                      Problem link
                    </span>
                    <a
                      href={selectedRowForDetail.rawLink}
                      target="_blank"
                      rel="noreferrer"
                      className="text-foreground underline underline-offset-2 hover:text-muted-foreground flex items-center gap-1.5"
                    >
                      {selectedRowForDetail.rawLink}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                    <div className="border border-border bg-muted/20 p-2.5">
                      <span className="text-muted-foreground text-[10px] font-mono  block">Topic</span>
                      <span className="text-foreground font-medium">{selectedRowForDetail.rawTopic || "-"}</span>
                    </div>
                    <div className="border border-border bg-muted/20 p-2.5">
                      <span className="text-muted-foreground text-[10px] font-mono  block">Pattern</span>
                      <span className="text-foreground font-medium">{selectedRowForDetail.rawPattern || "-"}</span>
                    </div>
                    <div className="border border-border bg-muted/20 p-2.5">
                      <span className="text-muted-foreground text-[10px] font-mono  block">Status</span>
                      <span className="text-foreground font-medium">{selectedRowForDetail.parsedStatus}</span>
                    </div>
                    <div className="border border-border bg-muted/20 p-2.5">
                      <span className="text-muted-foreground text-[10px] font-mono  block">Revisit?</span>
                      <span className="text-foreground font-medium">{selectedRowForDetail.parsedRevisit ? "Yes" : "No"}</span>
                    </div>
                  </div>

                  <div>
                    <span className="text-muted-foreground text-[10px] font-mono  tracking-wider block mb-1">
                      Core idea / intuition notes:
                    </span>
                    <div className="border border-border bg-muted/20 p-3 text-foreground whitespace-pre-wrap max-h-48 overflow-y-auto leading-relaxed">
                      {selectedRowForDetail.rawIdea || <span className="text-muted-foreground italic">No idea notes logged.</span>}
                    </div>
                  </div>

                  <div>
                    <span className="text-muted-foreground text-[10px] font-mono  tracking-wider block mb-1">
                      What I did wrong / trap notes:
                    </span>
                    <div className="border border-border bg-muted/20 p-3 text-foreground whitespace-pre-wrap max-h-48 overflow-y-auto leading-relaxed">
                      {selectedRowForDetail.rawMistake || <span className="text-muted-foreground italic">No mistake notes logged.</span>}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-3 border-t border-border">
                  <Button
                    variant="secondary"
                    onClick={() => setSelectedRowForDetail(null)}
                    className="text-xs"
                  >
                    Close
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
