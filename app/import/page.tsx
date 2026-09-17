"use client";
import React from 'react';

import { useState } from "react";
import {
  FileText,
  CheckCircle,
  AlertTriangle,
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
import { cn, safeHref } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SpecGrid, SpecCell } from "@/components/ui/spec-sheet";
import { SheetSection } from "@/components/ui/sheet-section";

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
      if (selected.size > 2_000_000) {
        setError("CSV file is too large (max 2 MB).");
        setFile(null);
        setCsvText("");
        return;
      }
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
    <div className="max-w-5xl">
      <SheetSection innerClassName="py-6">
        <h1 className="type-title text-foreground">Import workflow</h1>
        <p className="mt-1 type-caption">
          Migrate your personal 9-column solved-problems spreadsheet. Preserves all notes, ideas,
          mistakes, topics, and custom patterns with pre-commit duplicate resolution.
        </p>
      </SheetSection>

      {committedCount != null ? (
        <SheetSection innerClassName="space-y-4 py-8 text-center" last>
          <CheckCircle className="mx-auto h-10 w-10 text-foreground" />
          <div className="space-y-1">
            <h2 className="type-heading text-foreground">Import committed successfully</h2>
            <p className="type-caption">
              Ingested{" "}
              <span className="font-semibold tabular-nums text-foreground">{committedCount}</span>{" "}
              entries with preserved custom patterns and 21-day FSRS schedule spread.
            </p>
          </div>
          <div className="flex justify-center gap-3 pt-2 text-xs">
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
        </SheetSection>
      ) : (
        <>
          <SheetSection innerClassName="space-y-4 py-6">
            <div className="flex items-center gap-2 type-heading text-foreground">
              <span className="flex h-5 w-5 items-center justify-center border border-border bg-muted text-[10px] tabular-nums text-muted-foreground">
                1
              </span>
              Select solved-problems CSV file
            </div>

            <div className="flex flex-col items-center gap-4 sm:flex-row">
              <label className="flex w-full cursor-pointer items-center justify-center gap-2 border border-dashed border-border bg-background px-5 py-3 text-xs text-foreground transition-colors hover:bg-muted/40 sm:w-auto">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span>{file ? file.name : "Choose .csv file..."}</span>
                <input type="file" accept=".csv" onChange={handleFileChange} className="hidden" />
              </label>

              {file && rows.length === 0 && (
                <Button
                  variant="primary"
                  onClick={handleDryRun}
                  disabled={isProcessing}
                  className="w-full sm:w-auto"
                >
                  {isProcessing && <RefreshCw className="mr-2 h-3.5 w-3.5 animate-spin" />}
                  Run dry-run verification
                </Button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 border-t border-border pt-3 type-caption sm:grid-cols-3 md:grid-cols-5">
              <span>1. Problem name</span>
              <span>2. Problem link</span>
              <span>3. Topic</span>
              <span>4. Pattern</span>
              <span>5. Idea</span>
              <span>6. What I did wrong</span>
              <span>7. Status</span>
              <span>8. Revisit?</span>
              <span>9. Source</span>
            </div>
          </SheetSection>

          {error && (
            <SheetSection innerClassName="py-3">
              <div className="border border-destructive/50 bg-destructive/10 p-4 text-xs text-destructive">
                {error}
              </div>
            </SheetSection>
          )}

          {duplicateGroups.length > 0 && (
            <SheetSection innerClassName="space-y-4 py-6">
              <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                <div className="flex items-center gap-2 text-xs font-medium text-warning">
                  <AlertTriangle className="h-4 w-4" />
                  <span>
                    Pre-commit resolution: {duplicateGroups.length} CSV duplicate group(s) detected
                  </span>
                </div>
                <span className="type-caption">
                  Resolve or merge these rows below so no personal notes are lost.
                </span>
              </div>

              <div className="space-y-4">
                {duplicateGroups.map((group, gIdx) => (
                  <div key={group.groupId} className="space-y-3 border border-border bg-background p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2">
                      <span className="text-xs font-semibold text-foreground">
                        Conflict group #{gIdx + 1}: Target{" "}
                        {group.matchedProblemTitle || group.matchedKey}
                      </span>
                      {group.suggestedFixes.length === 0 && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleMergeGroupRows(group.groupId)}
                        >
                          <GitMerge className="mr-1.5 h-3 w-3" />
                          Merge both rows (combine notes)
                        </Button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      {group.rows.map((r) => {
                        const fix = group.suggestedFixes.find((f) => f.rowIndex === r.rowIndex);

                        return (
                          <div
                            key={r.rowIndex}
                            className={cn(
                              "space-y-2 p-3 text-xs",
                              fix ? "bg-warning/5" : "bg-muted/20"
                            )}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-foreground">
                                Row #{r.rowIndex}: {r.rawName}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleKeepRow(group.groupId, r.rowIndex)}
                                className="text-[10px] text-muted-foreground underline underline-offset-2 hover:text-foreground"
                              >
                                Keep this row only
                              </button>
                            </div>

                            <div
                              className="truncate type-caption"
                              title={r.rawLink}
                            >
                              <span className="text-muted-foreground/70">URL: </span>
                              {r.rawLink}
                            </div>

                            <div className="flex flex-wrap gap-2">
                              {r.rawTopic && <Badge variant="pattern">Topic: {r.rawTopic}</Badge>}
                              {r.rawPattern && (
                                <Badge variant="outline">Pattern: {r.rawPattern}</Badge>
                              )}
                              <Badge variant="outline">Status: {r.parsedStatus}</Badge>
                              {r.parsedRevisit && <Badge variant="overdue">Revisit</Badge>}
                            </div>

                            <div className="max-h-20 overflow-y-auto bg-background p-2 text-[11px] text-foreground">
                              <span className="mb-0.5 block type-label">Idea / intuition</span>
                              {r.rawIdea || (
                                <span className="italic text-muted-foreground">None</span>
                              )}
                            </div>

                            <div className="max-h-20 overflow-y-auto bg-background p-2 text-[11px] text-foreground">
                              <span className="mb-0.5 block type-label">What I did wrong</span>
                              {r.rawMistake || (
                                <span className="italic text-muted-foreground">None</span>
                              )}
                            </div>

                            {fix && (
                              <div className="border-t border-border pt-2">
                                <div className="mb-2 text-[11px] text-warning">{fix.reason}</div>
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() =>
                                    handleApplySuggestedFix(group.groupId, r.rowIndex, fix)
                                  }
                                  className="w-full justify-center"
                                >
                                  <Wand2 className="mr-1.5 h-3.5 w-3.5" />
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
            </SheetSection>
          )}

          {rows.length > 0 && (
            <>
              <SheetSection innerClassName="py-6" band="neutral">
                <SpecGrid columns={5}>
                  <SpecCell label="Total rows" value={rows.length} />
                  <SpecCell label="Matched to catalog" value={matchedCatalogCount} />
                  <SpecCell label="New problems" value={newProblemsCount} />
                  <SpecCell label="Db conflicts" value={existingEntryConflictCount} />
                  <SpecCell
                    label="Unresolved dupes"
                    value={unresolvedDuplicateCount}
                    className={unresolvedDuplicateCount > 0 ? "text-warning" : ""}
                  />
                </SpecGrid>
              </SheetSection>

              <SheetSection innerClassName="space-y-4 py-6">
                <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
                  <div>
                    <span className="block font-semibold text-foreground">
                      Prior database conflict strategy
                    </span>
                    <span className="type-caption">
                      Controls entries already logged in your database from previous imports (does
                      not affect CSV duplicates).
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-foreground">
                    <label className="flex cursor-pointer items-center gap-2">
                      <input
                        type="radio"
                        name="conflictStrategy"
                        value="SKIP"
                        checked={conflictStrategy === "SKIP"}
                        onChange={() => setConflictStrategy("SKIP")}
                        className="accent-orange-500"
                      />
                      <span>Skip existing DB entries</span>
                    </label>
                    <label className="flex cursor-pointer items-center gap-2">
                      <input
                        type="radio"
                        name="conflictStrategy"
                        value="OVERWRITE"
                        checked={conflictStrategy === "OVERWRITE"}
                        onChange={() => setConflictStrategy("OVERWRITE")}
                        className="accent-orange-500"
                      />
                      <span>Update / overwrite existing</span>
                    </label>
                  </div>
                </div>

                <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
                  <div className="text-xs text-muted-foreground">
                    {unresolvedDuplicateCount > 0 ? (
                      <span className="flex items-center gap-1.5 text-warning">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Please resolve the {unresolvedDuplicateCount} duplicate conflict(s) above
                        before committing.
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-foreground">
                        <Check className="h-3.5 w-3.5 text-easy" />
                        All rows verified and ready to commit. 100% data preservation guaranteed.
                      </span>
                    )}
                  </div>

                  <Button
                    variant="primary"
                    onClick={handleCommit}
                    disabled={isProcessing || unresolvedDuplicateCount > 0}
                    className="w-full sm:w-auto"
                  >
                    {isProcessing ? (
                      <RefreshCw className="mr-2 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Check className="mr-2 h-3.5 w-3.5" />
                    )}
                    Commit {rows.length} problems to database
                  </Button>
                </div>
              </SheetSection>

              <SheetSection innerClassName="py-6" last={!selectedRowForDetail}>
                <div className="overflow-hidden border border-border bg-background text-xs">
                  <div className="max-h-[550px] overflow-y-auto">
                    <table className="w-full text-left">
                      <thead className="sticky top-0 border-b border-border bg-muted/40 type-label text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2.5">#</th>
                          <th className="px-3 py-2.5">Raw name</th>
                          <th className="px-3 py-2.5">Topic</th>
                          <th className="px-3 py-2.5">Pattern</th>
                          <th className="px-3 py-2.5">Idea</th>
                          <th className="px-3 py-2.5">What I did wrong</th>
                          <th className="px-3 py-2.5">Catalog target</th>
                          <th className="px-3 py-2.5">Status</th>
                          <th className="px-3 py-2.5">Inspect</th>
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
                            <td className="px-3 py-2 tabular-nums text-muted-foreground">
                              {row.rowIndex}
                            </td>
                            <td
                              className="max-w-[180px] truncate px-3 py-2 font-medium text-foreground"
                              title={row.rawName}
                            >
                              {row.rawName}
                            </td>
                            <td
                              className="max-w-[100px] truncate px-3 py-2 text-muted-foreground"
                              title={row.rawTopic}
                            >
                              {row.rawTopic || "—"}
                            </td>
                            <td className="px-3 py-2">
                              {row.rawPattern ? (
                                <Badge variant="pattern">{row.rawPattern}</Badge>
                              ) : (
                                <span className="text-muted-foreground/60">—</span>
                              )}
                            </td>
                            <td
                              className="max-w-[150px] truncate px-3 py-2 text-muted-foreground"
                              title={row.rawIdea}
                            >
                              {row.rawIdea || (
                                <span className="text-muted-foreground/60">—</span>
                              )}
                            </td>
                            <td
                              className="max-w-[150px] truncate px-3 py-2 text-muted-foreground"
                              title={row.rawMistake}
                            >
                              {row.rawMistake || (
                                <span className="text-muted-foreground/60">—</span>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              <span
                                className="block max-w-[200px] truncate font-medium text-foreground"
                                title={row.matchedTitle}
                              >
                                {row.matchedNumber != null ? `#${row.matchedNumber} ` : ""}
                                {row.matchedTitle}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-[11px] text-muted-foreground">
                              {row.parsedStatus}
                            </td>
                            <td className="px-3 py-2">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedRowForDetail(row);
                                }}
                                className="border border-border bg-background p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
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
              </SheetSection>
            </>
          )}

          {selectedRowForDetail && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm animate-in fade-in">
              <div className="w-full max-w-2xl space-y-4 border border-border bg-background p-6 shadow-xl">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <div>
                    <span className="type-label">Row #{selectedRowForDetail.rowIndex}</span>
                    <h2 className="type-heading text-foreground">
                      {selectedRowForDetail.rawName}
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedRowForDetail(null)}
                    className="p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="space-y-4 text-xs">
                  <div>
                    <span className="mb-1 block type-label">Problem link</span>
                    {safeHref(selectedRowForDetail.rawLink) ? (
                      <a
                        href={safeHref(selectedRowForDetail.rawLink)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-orange-600 underline underline-offset-2 hover:text-orange-700"
                      >
                        {selectedRowForDetail.rawLink}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      <span className="text-muted-foreground">
                        {selectedRowForDetail.rawLink || "—"}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-px border border-border bg-border sm:grid-cols-4">
                    <div className="bg-background p-2.5">
                      <span className="block type-label">Topic</span>
                      <span className="font-medium text-foreground">
                        {selectedRowForDetail.rawTopic || "—"}
                      </span>
                    </div>
                    <div className="bg-background p-2.5">
                      <span className="block type-label">Pattern</span>
                      <span className="font-medium text-foreground">
                        {selectedRowForDetail.rawPattern || "—"}
                      </span>
                    </div>
                    <div className="bg-background p-2.5">
                      <span className="block type-label">Status</span>
                      <span className="font-medium text-foreground">
                        {selectedRowForDetail.parsedStatus}
                      </span>
                    </div>
                    <div className="bg-background p-2.5">
                      <span className="block type-label">Revisit?</span>
                      <span className="font-medium text-foreground">
                        {selectedRowForDetail.parsedRevisit ? "Yes" : "No"}
                      </span>
                    </div>
                  </div>

                  <div>
                    <span className="mb-1 block type-label">Core idea / intuition notes</span>
                    <div className="max-h-48 overflow-y-auto whitespace-pre-wrap border border-border bg-muted/20 p-3 font-mono leading-relaxed text-foreground">
                      {selectedRowForDetail.rawIdea || (
                        <span className="font-sans italic text-muted-foreground">
                          No idea notes logged.
                        </span>
                      )}
                    </div>
                  </div>

                  <div>
                    <span className="mb-1 block type-label">What I did wrong / trap notes</span>
                    <div className="max-h-48 overflow-y-auto whitespace-pre-wrap border border-border bg-muted/20 p-3 font-mono leading-relaxed text-foreground">
                      {selectedRowForDetail.rawMistake || (
                        <span className="font-sans italic text-muted-foreground">
                          No mistake notes logged.
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end border-t border-border pt-3">
                  <Button variant="secondary" onClick={() => setSelectedRowForDetail(null)}>
                    Close
                  </Button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
