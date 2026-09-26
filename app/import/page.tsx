"use client";
import React, { useState } from "react";
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
  ClipboardPaste,
  Upload,
  ArrowLeft,
  ArrowRight,
  Camera,
} from "lucide-react";
import {
  dryRunImportCSV,
  commitImportBatch,
  inspectImportCSV,
  DryRunRow,
  DuplicateGroup,
  mergeTwoRows,
  type CsvInspection,
} from "@/app/actions/import-actions";
import {
  ColumnMapper,
  initialChoices,
  resolveChoices,
  type ColumnChoices,
} from "@/components/import/column-mapper";
import type { CustomFieldDef } from "@/lib/custom-fields";
import { cn, formatDifficulty, safeHref } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SpecGrid, SpecCell } from "@/components/ui/spec-sheet";
import { SheetSection } from "@/components/ui/sheet-section";
import { PromptCopyPanel } from "@/components/import/prompt-copy-panel";
import { WizardStepper, type WizardPhase, wizardOrder } from "@/components/import/wizard-stepper";
import {
  BulkStatusOverride,
  applyStatusOverride,
  type OverrideMode,
} from "@/components/import/bulk-status-override";
import { SolveStatus } from "@prisma/client";

const MAX_PASTE_CHARS = 2_000_000;

/** Heuristics that catch Gemini-style grounding artefacts before the dry-run runs. */
function detectCitationArtefacts(text: string): string | null {
  if (!text) return null;
  if (/utm_source=gemini/i.test(text)) return "gemini";
  if (/google\.com\/search\?q=https/i.test(text)) return "grounding";
  if (/\]\(https?:\/\/[^)\s]+\)/.test(text)) return "markdown";
  if (/^\s*```/.test(text)) return "codefence";
  return null;
}

const PHASE_ORDER: WizardPhase[] = ["brief", "compose", "load", "map", "review", "assign", "confirm"];

export default function ImportPage() {
  // Wizard state
  const [phase, setPhase] = useState<WizardPhase>("brief");
  const [furthestReached, setFurthestReached] = useState<WizardPhase>("brief");

  // Input state
  const [pathway, setPathway] = useState<"screenshot" | "upload" | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [csvText, setCsvText] = useState<string>("");
  const [pastedText, setPastedText] = useState<string>("");
  const [inputMode, setInputMode] = useState<"paste" | "file">("paste");

  // Dry-run state
  const [inspection, setInspection] = useState<CsvInspection | null>(null);
  const [choices, setChoices] = useState<ColumnChoices>({});
  const [importFields, setImportFields] = useState<CustomFieldDef[]>([]);
  const [rows, setRows] = useState<DryRunRow[]>([]);
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([]);
  const [conflictStrategy, setConflictStrategy] = useState<"SKIP" | "OVERWRITE">("SKIP");
  const [selectedRowForDetail, setSelectedRowForDetail] = useState<DryRunRow | null>(null);
  const [showFullTable, setShowFullTable] = useState(false);

  // Status override
  const [overrideMode, setOverrideMode] = useState<OverrideMode>("ALL_COLD");
  const [perRowStatus, setPerRowStatus] = useState<Record<number, SolveStatus>>({});

  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [committedCount, setCommittedCount] = useState<number | null>(null);

  const advanceTo = (next: WizardPhase) => {
    setPhase(next);
    if (wizardOrder[next] > wizardOrder[furthestReached]) {
      setFurthestReached(next);
    }
    setError(null);
  };

  const goBack = () => {
    const idx = wizardOrder[phase];
    if (idx > 0) advanceTo(PHASE_ORDER[idx - 1]);
  };

  const resetAll = () => {
    setPhase("brief");
    setFurthestReached("brief");
    setPathway(null);
    setFile(null);
    setCsvText("");
    setPastedText("");
    setInputMode("paste");
    setInspection(null);
    setChoices({});
    setImportFields([]);
    setRows([]);
    setDuplicateGroups([]);
    setConflictStrategy("SKIP");
    setSelectedRowForDetail(null);
    setShowFullTable(false);
    setOverrideMode("ALL_COLD");
    setPerRowStatus({});
    setError(null);
    setCommittedCount(null);
  };

  // --- Input handlers -------------------------------------------------------

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
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
      invalidateReview();
    };
    reader.readAsText(selected);
    setError(null);
  };

  const invalidateReview = () => {
    // Any change to the source CSV makes prior dry-run results stale.
    if (rows.length > 0) {
      setRows([]);
      setDuplicateGroups([]);
    }
    if (wizardOrder[furthestReached] > wizardOrder.load) {
      setFurthestReached("load");
    }
  };

  const handlePastedChange = (value: string) => {
    if (value.length > MAX_PASTE_CHARS) {
      setError("Pasted CSV is too large (max 2 MB).");
      return;
    }
    setPastedText(value);
    setCsvText(value);
    setFile(null);
    invalidateReview();
    if (error) setError(null);
  };

  const switchInputMode = (mode: "file" | "paste") => {
    setInputMode(mode);
    setError(null);
    if (mode === "file") {
      setPastedText("");
      if (!file) setCsvText("");
    } else {
      setFile(null);
      setCsvText(pastedText);
    }
  };

  const handlePerRowStatus = (rowIndex: number, status: SolveStatus) => {
    setPerRowStatus((prev) => ({ ...prev, [rowIndex]: status }));
  };

  // --- Dry run + commit ----------------------------------------------------

  // Read the sheet's columns and suggest where each one goes.
  const handleInspect = async () => {
    if (!csvText.trim()) return;
    setIsProcessing(true);
    setError(null);
    try {
      const result = await inspectImportCSV(csvText);
      if (result.columns.length === 0 || result.rowCount === 0) {
        setError("No rows detected. Make sure the first line is a header row.");
        return;
      }
      setInspection(result);
      setChoices(initialChoices(result));
      advanceTo("map");
    } catch (err) {
      setError(String(err));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDryRun = async () => {
    if (!csvText.trim() || !inspection) return;
    const { mapping, fields, errors } = resolveChoices(choices, inspection.existingFields);
    if (errors.length > 0) {
      setError(errors[0]);
      return;
    }
    setIsProcessing(true);
    setError(null);
    try {
      const summary = await dryRunImportCSV(csvText, mapping);
      setImportFields(fields);
      setRows(summary.rows);
      setDuplicateGroups(summary.duplicateGroups);
      if (summary.rows.length === 0) {
        setError(
          "No rows detected. Make sure the first line is a header row matching the expected columns."
        );
      } else {
        advanceTo("review");
      }
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
      const rowsToCommit = applyStatusOverride(rows, overrideMode, perRowStatus);
      const result = await commitImportBatch({
        rows: rowsToCommit,
        filename: file?.name || "import.csv",
        conflictStrategy,
        customFields: importFields,
      });
      setCommittedCount(result.count);
    } catch (err) {
      setError(String(err));
    } finally {
      setIsProcessing(false);
    }
  };

  // --- Derived --------------------------------------------------------------

  const existingEntryConflictCount = rows.filter((r) => r.alreadyExistsInDB).length;
  const unresolvedDuplicateCount = duplicateGroups.length;
  const hasInput = Boolean(csvText.trim());
  const artefact = detectCitationArtefacts(csvText);
  const reviewReady = rows.length > 0 && unresolvedDuplicateCount === 0;

  // Post-commit success screen bypasses the wizard entirely.
  if (committedCount != null) {
    return (
      <div>
        <SheetSection innerClassName="py-6">
          <h1 className="type-title text-foreground">Import</h1>
        </SheetSection>
        <SheetSection innerClassName="space-y-4 py-10 text-center" last>
          <CheckCircle className="mx-auto h-10 w-10 text-easy" />
          <div className="space-y-1">
            <h2 className="type-heading text-foreground">Committed.</h2>
            <p className="type-caption">
              Added{" "}
              <span className="font-semibold tabular-nums text-foreground">{committedCount}</span>{" "}
              entries. Due dates spread over the next 60 days so your queue doesn&apos;t flood.
            </p>
          </div>
          <div className="flex flex-col items-center justify-center gap-2 pt-2 sm:flex-row">
            <Button variant="primary" onClick={() => (window.location.href = "/problems")}>
              See your problems
            </Button>
            <Button variant="secondary" onClick={resetAll}>
              Import another
            </Button>
          </div>
        </SheetSection>
      </div>
    );
  }

  return (
    <div>
      <SheetSection innerClassName="py-6">
        <h1 className="type-title text-foreground">Import</h1>
        <p className="mt-1 type-caption">
          Bring your LeetCode history or your own sheet in. Seven quick steps.
        </p>
      </SheetSection>

      <SheetSection innerClassName="py-4">
        <WizardStepper
          current={phase}
          onJump={(target) => setPhase(target)}
          furthestReached={furthestReached}
        />
      </SheetSection>

      {error && (
        <SheetSection innerClassName="py-3">
          <div className="flex items-start gap-2 border border-destructive/50 bg-destructive/10 p-4 text-xs text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        </SheetSection>
      )}

      {/* ================================================================ */}
      {phase === "brief" && (
        <SheetSection innerClassName="space-y-8 py-8">
          <div className="max-w-2xl space-y-2">
            <h2 className="text-2xl font-medium tracking-tight text-foreground sm:text-3xl">
              How do you want to import?
            </h2>
            <p className="type-body text-muted-foreground">
              Pick how your data is coming in. Both paths end at the same review step.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Path A: Screenshot → LLM → CSV */}
            <button
              type="button"
              onClick={() => {
                setPathway("screenshot");
                advanceTo("compose");
              }}
              className="group flex flex-col items-start gap-3 border border-border bg-background p-5 text-left transition-colors hover:border-orange-500/50 hover:bg-orange-500/5"
            >
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center border border-border bg-muted text-muted-foreground group-hover:border-orange-500/50 group-hover:text-orange-600">
                  <Camera className="h-4 w-4" />
                </span>
                <span className="text-sm font-semibold text-foreground">From screenshots</span>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Already solved questions on LeetCode? Screenshot your{" "}
                <span className="font-mono text-foreground">leetcode.com/progress</span>{" "}
                page, feed the images to any LLM with our prompt, and paste the CSV it gives you.
                We&apos;ll match everything to our catalog and schedule reviews.
              </p>
              <span className="mt-auto flex items-center gap-1.5 text-xs font-medium text-orange-600 opacity-0 transition-opacity group-hover:opacity-100">
                Start here <ArrowRight className="h-3 w-3" />
              </span>
            </button>

            {/* Path B: Already have a CSV / spreadsheet */}
            <button
              type="button"
              onClick={() => {
                setPathway("upload");
                setInputMode("file");
                advanceTo("load");
              }}
              className="group flex flex-col items-start gap-3 border border-border bg-background p-5 text-left transition-colors hover:border-orange-500/50 hover:bg-orange-500/5"
            >
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center border border-border bg-muted text-muted-foreground group-hover:border-orange-500/50 group-hover:text-orange-600">
                  <Upload className="h-4 w-4" />
                </span>
                <span className="text-sm font-semibold text-foreground">Upload a spreadsheet</span>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Already tracking in Google Sheets, Excel, or a .csv? Export as CSV and upload it directly.
                We&apos;ll map your columns to ours.
              </p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {[".csv", "Google Sheets", "Excel"].map((tag) => (
                  <span
                    key={tag}
                    className="border border-border bg-muted/40 px-1.5 py-0.5 text-[10px] text-muted-foreground"
                  >
                    {tag}
                  </span>
                ))}
              </div>
              <span className="mt-auto flex items-center gap-1.5 text-xs font-medium text-orange-600 opacity-0 transition-opacity group-hover:opacity-100">
                Upload CSV <ArrowRight className="h-3 w-3" />
              </span>
            </button>
          </div>
        </SheetSection>
      )}

      {/* ================================================================ */}
      {phase === "compose" && (
        <SheetSection innerClassName="space-y-6 py-6">
          <PhaseHeader
            step={1}
            title="Get the CSV from any LLM"
            body="Copy the prompt below. Open Claude, ChatGPT, or Gemini — disable web search / grounding / citations first — paste the prompt, and attach your /progress screenshots. The reply will be plain CSV text."
          />

          <div className="flex items-center gap-2 border border-border bg-muted/20 p-3 text-xs">
            <span className="text-muted-foreground">Go to your progress page:</span>
            <a
              href="https://leetcode.com/progress/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-mono text-orange-600 underline underline-offset-2 hover:text-orange-700"
            >
              leetcode.com/progress
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          <PromptCopyPanel />

          <PhaseNav
            onBack={goBack}
            primary={{
              label: "I have the CSV — continue",
              onClick: () => advanceTo("load"),
            }}
          />
        </SheetSection>
      )}

      {/* ================================================================ */}
      {phase === "load" && (
        <SheetSection innerClassName="space-y-6 py-6">
          <PhaseHeader
            step={2}
            title={pathway === "upload" ? "Upload your CSV" : "Paste the CSV"}
            body={pathway === "upload"
              ? "Drop your .csv file here. We'll read the columns and let you map them in the next step."
              : "Paste the CSV text from your LLM below, or switch to file upload if you saved it."}
          />

          <div className="inline-flex border border-border">
            <button
              type="button"
              onClick={() => switchInputMode("paste")}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs transition-colors",
                inputMode === "paste"
                  ? "bg-orange-500 text-white"
                  : "bg-background text-muted-foreground hover:bg-muted/40 hover:text-foreground"
              )}
            >
              <ClipboardPaste className="h-3 w-3" />
              Paste text
            </button>
            <button
              type="button"
              onClick={() => switchInputMode("file")}
              className={cn(
                "inline-flex items-center gap-1.5 border-l border-border px-3 py-1.5 text-xs transition-colors",
                inputMode === "file"
                  ? "bg-orange-500 text-white"
                  : "bg-background text-muted-foreground hover:bg-muted/40 hover:text-foreground"
              )}
            >
              <Upload className="h-3 w-3" />
              Upload file
            </button>
          </div>

          {inputMode === "paste" ? (
            <div className="space-y-2">
              <textarea
                value={pastedText}
                onChange={(e) => handlePastedChange(e.target.value)}
                placeholder={`Paste the CSV text here.\n\nFirst line must be the header row, e.g.:\nProblem Name,Problem Link,Pattern,Idea,Solved Date,Source`}
                rows={12}
                className="w-full resize-y border border-border bg-background p-3 font-mono text-[11px] leading-relaxed text-foreground outline-none focus:border-orange-500"
                spellCheck={false}
              />
              <div className="flex items-center justify-between type-caption">
                <span>
                  {pastedText.length.toLocaleString()} / {MAX_PASTE_CHARS.toLocaleString()} chars
                </span>
                {pastedText && (
                  <button
                    type="button"
                    onClick={() => handlePastedChange("")}
                    className="text-muted-foreground underline underline-offset-2 hover:text-foreground"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          ) : (
            <label className="flex w-full cursor-pointer items-center justify-center gap-2 border border-dashed border-border bg-background px-5 py-8 text-xs text-foreground transition-colors hover:bg-muted/40">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span>{file ? file.name : "Choose .csv file…"}</span>
              <input type="file" accept=".csv" onChange={handleFileChange} className="hidden" />
            </label>
          )}

          {hasInput && artefact && (
            <div className="border border-warning/50 bg-warning/10 p-3 text-[11px] leading-relaxed text-warning">
              <strong className="font-semibold">Your LLM injected citations or grounding.</strong>{" "}
              {artefact === "gemini" || artefact === "grounding"
                ? "We can see Google-search grounding markers (utm_source=gemini) in the text."
                : artefact === "markdown"
                  ? "There are markdown link wrappers around the URLs."
                  : "There is a code fence around the CSV."}{" "}
              We&apos;ll strip what we can, but re-running the prompt with grounding / web search
              disabled gives you cleaner data.
            </div>
          )}

          <PhaseNav
            onBack={goBack}
            primary={{
              label: isProcessing ? "Reading columns…" : "Continue",
              onClick: handleInspect,
              disabled: !hasInput || isProcessing,
              loading: isProcessing,
            }}
          />
        </SheetSection>
      )}

      {/* ================================================================ */}
      {phase === "map" && inspection && (
        <SheetSection innerClassName="space-y-6 py-6">
          <PhaseHeader
            step={3}
            title="Map your columns"
            body="Keep your sheet the way it works for you. Columns that match ours are linked automatically; anything else becomes your own field, shown when you log and on each problem. Scheduling only uses our built-in fields."
          />

          <ColumnMapper inspection={inspection} choices={choices} onChange={setChoices} />

          <PhaseNav
            onBack={() => advanceTo("load")}
            backLabel="Back to CSV"
            primary={{
              label: isProcessing ? "Verifying…" : "Verify import",
              onClick: handleDryRun,
              disabled: isProcessing,
              loading: isProcessing,
            }}
          />
        </SheetSection>
      )}

      {/* ================================================================ */}
      {phase === "review" && (
        <SheetSection innerClassName="space-y-6 py-6">
          <PhaseHeader
            step={4}
            title="Review the matches"
            body="We tried to match every row to our problem catalog. Here's what we found."
          />

          <SpecGrid columns={4}>
            <SpecCell label="Problems detected" value={rows.length} />
            <SpecCell
              label="New to add"
              value={Math.max(0, rows.length - existingEntryConflictCount)}
            />
            <SpecCell
              label="Already logged"
              value={existingEntryConflictCount}
              className={existingEntryConflictCount > 0 ? "text-warning" : ""}
            />
            <SpecCell
              label="Needs your review"
              value={unresolvedDuplicateCount}
              className={unresolvedDuplicateCount > 0 ? "text-warning" : ""}
            />
          </SpecGrid>

          {unresolvedDuplicateCount > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-medium text-warning">
                <AlertTriangle className="h-4 w-4" />
                <span>
                  {unresolvedDuplicateCount} duplicate group(s) in the CSV — resolve to continue
                </span>
              </div>

              <div className="space-y-3">
                {duplicateGroups.map((group, gIdx) => (
                  <div key={group.groupId} className="space-y-3 border border-border bg-background p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2">
                      <span className="text-xs font-semibold text-foreground">
                        Group {gIdx + 1}: {group.matchedProblemTitle || group.matchedKey}
                      </span>
                      {group.suggestedFixes.length === 0 && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleMergeGroupRows(group.groupId)}
                        >
                          <GitMerge className="mr-1.5 h-3 w-3" />
                          Merge notes
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
                                Keep only this
                              </button>
                            </div>
                            {r.rawPattern && (
                              <Badge variant="pattern">Pattern: {r.rawPattern}</Badge>
                            )}
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
                                  Remap to #{fix.suggestedNumber} {fix.suggestedTitle}
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

          {existingEntryConflictCount > 0 && (
            <div className="space-y-3 border border-border bg-muted/20 p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                <div>
                  <span className="block text-xs font-medium text-foreground">
                    {existingEntryConflictCount} row(s) already exist in your log
                  </span>
                  <span className="type-caption">
                    Choose what happens to them.
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setConflictStrategy("SKIP")}
                  className={cn(
                    "flex flex-col items-start gap-1 border p-3 text-left text-xs transition-colors",
                    conflictStrategy === "SKIP"
                      ? "border-orange-500 bg-orange-500/5"
                      : "border-border bg-background hover:bg-muted/40"
                  )}
                >
                  <span className="font-medium text-foreground">Skip existing</span>
                  <span className="type-caption">
                    Keep your current notes and schedule. Only new problems get added.
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setConflictStrategy("OVERWRITE")}
                  className={cn(
                    "flex flex-col items-start gap-1 border p-3 text-left text-xs transition-colors",
                    conflictStrategy === "OVERWRITE"
                      ? "border-orange-500 bg-orange-500/5"
                      : "border-border bg-background hover:bg-muted/40"
                  )}
                >
                  <span className="font-medium text-foreground">Overwrite with CSV</span>
                  <span className="type-caption">
                    Replace notes, pattern, and status with what the CSV says.
                  </span>
                </button>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between border-t border-border pt-3">
            <button
              type="button"
              onClick={() => setShowFullTable((v) => !v)}
              className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              {showFullTable ? "Hide" : "Show"} all {rows.length} rows
            </button>
            {reviewReady && (
              <span className="flex items-center gap-1.5 text-xs text-easy">
                <Check className="h-3.5 w-3.5" />
                All rows ready
              </span>
            )}
          </div>

          {showFullTable && (
            <div className="overflow-hidden border border-border bg-background text-xs">
              <div className="max-h-[400px] overflow-y-auto">
                <table className="w-full text-left">
                  <thead className="sticky top-0 border-b border-border bg-muted/40 type-label text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2.5">#</th>
                      <th className="px-3 py-2.5">Row</th>
                      <th className="px-3 py-2.5">Diff</th>
                      <th className="px-3 py-2.5">Pattern</th>
                      <th className="px-3 py-2.5">Time</th>
                      <th className="px-3 py-2.5">Matched to</th>
                      <th className="px-3 py-2.5"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {rows.map((row) => (
                      <tr
                        key={row.rowIndex}
                        className={cn(
                          "hover:bg-muted/30",
                          row.isDuplicateInCSV && "bg-warning/10",
                          row.alreadyExistsInDB && !row.isDuplicateInCSV && "bg-muted/30"
                        )}
                      >
                        <td className="px-3 py-2 tabular-nums text-muted-foreground">
                          {row.rowIndex}
                        </td>
                        <td
                          className="max-w-[220px] truncate px-3 py-2 font-medium text-foreground"
                          title={row.rawName}
                        >
                          {row.rawName}
                        </td>
                        <td className="px-3 py-2">
                          {row.parsedDifficulty ? (
                            <span className={cn("px-1.5 py-0.5 text-[10px]", formatDifficulty(row.parsedDifficulty).className)}>
                              {formatDifficulty(row.parsedDifficulty).label}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/60">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {row.rawPattern ? (
                            <Badge variant="pattern">{row.rawPattern}</Badge>
                          ) : (
                            <span className="text-muted-foreground/60">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2 tabular-nums text-muted-foreground">
                          {row.parsedMinutes != null ? `${row.parsedMinutes}m` : "—"}
                        </td>
                        <td
                          className="max-w-[220px] truncate px-3 py-2 text-muted-foreground"
                          title={row.matchedTitle}
                        >
                          {row.matchedNumber != null ? `#${row.matchedNumber} ` : ""}
                          {row.matchedTitle}
                        </td>
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            onClick={() => setSelectedRowForDetail(row)}
                            className="border border-border bg-background p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                            title="Inspect"
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
          )}

          <PhaseNav
            onBack={() => {
              setRows([]);
              setDuplicateGroups([]);
              advanceTo("map");
            }}
            backLabel="Back to columns"
            primary={{
              label: "Continue",
              onClick: () => advanceTo("assign"),
              disabled: !reviewReady,
              hint: !reviewReady
                ? "Resolve the duplicate group(s) above to continue."
                : undefined,
            }}
          />
        </SheetSection>
      )}

      {/* ================================================================ */}
      {phase === "assign" && (
        <SheetSection innerClassName="space-y-6 py-6">
          <PhaseHeader
            step={5}
            title="How were they solved?"
            body="Screenshots don't say whether you needed a hint. Pick one bulk answer, or click through each row individually. This decides where each problem starts on the review curve."
          />

          <div className="border-l-2 border-orange-500 bg-orange-500/5 p-3 text-[11px] leading-relaxed text-muted-foreground">
            <strong className="font-medium text-foreground">Not sure?</strong> Pick{" "}
            <span className="font-mono">All Solved (cold)</span>. If it turns out you actually
            needed a hint, the scheduler shortens the interval on your first review — no penalty
            for guessing conservatively.
          </div>

          <BulkStatusOverride
            rows={rows}
            mode={overrideMode}
            perRow={perRowStatus}
            onModeChange={setOverrideMode}
            onPerRowChange={handlePerRowStatus}
          />

          <PhaseNav
            onBack={goBack}
            primary={{
              label: "Continue",
              onClick: () => advanceTo("confirm"),
            }}
          />
        </SheetSection>
      )}

      {/* ================================================================ */}
      {phase === "confirm" && (
        <SheetSection innerClassName="space-y-6 py-6">
          <PhaseHeader
            step={6}
            title="Ready to commit"
            body="Last look before we write to your log."
          />

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <SummaryCard
              label="Problems"
              value={rows.length}
              hint={
                existingEntryConflictCount > 0
                  ? `${Math.max(0, rows.length - existingEntryConflictCount)} new · ${existingEntryConflictCount} already logged`
                  : "All new to your log"
              }
            />
            <SummaryCard
              label="Marked as"
              value={
                overrideMode === "ALL_COLD"
                  ? "Solved (cold)"
                  : overrideMode === "ALL_HELP"
                    ? "Solved with help"
                    : overrideMode === "CSV"
                      ? "From CSV"
                      : "Per row"
              }
              hint={
                overrideMode === "PER_ROW"
                  ? `${Object.keys(perRowStatus).length} of ${rows.length} classified`
                  : undefined
              }
            />
            <SummaryCard
              label="Already logged"
              value={
                existingEntryConflictCount > 0
                  ? conflictStrategy === "SKIP"
                    ? "Kept as-is"
                    : "Overwritten"
                  : "—"
              }
              hint={
                existingEntryConflictCount > 0
                  ? `${existingEntryConflictCount} row${existingEntryConflictCount === 1 ? "" : "s"}`
                  : "No overlap"
              }
            />
          </div>

          <p className="type-caption">
            Due dates will be spread over the next ~60 days, weighted so &apos;with-help&apos;
            and &apos;revisit&apos; entries surface first.
          </p>

          <PhaseNav
            onBack={goBack}
            primary={{
              label: isProcessing ? "Committing…" : `Commit ${rows.length} entries`,
              onClick: handleCommit,
              disabled: isProcessing || rows.length === 0,
              loading: isProcessing,
            }}
          />
        </SheetSection>
      )}

      {selectedRowForDetail && (
        <div className="ui-overlay fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
          <div className="ui-modal w-full max-w-2xl space-y-4 border border-border bg-background p-5 shadow-lg">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <span className="type-label">Row #{selectedRowForDetail.rowIndex}</span>
                <h2 className="type-heading text-foreground">{selectedRowForDetail.rawName}</h2>
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

              <div>
                <span className="mb-1 block type-label">Core idea</span>
                <div className="max-h-48 overflow-y-auto whitespace-pre-wrap border border-border bg-muted/20 p-3 font-mono leading-relaxed text-foreground">
                  {selectedRowForDetail.rawIdea || (
                    <span className="font-sans italic text-muted-foreground">None</span>
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
    </div>
  );
}

// ------- Small presentational helpers scoped to this page --------------------

function PhaseHeader({
  step,
  title,
  body,
}: {
  step: number;
  title: string;
  body: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="flex h-5 w-5 items-center justify-center border border-border bg-muted text-[10px] tabular-nums text-muted-foreground">
          {step}
        </span>
        <h2 className="type-heading text-foreground">{title}</h2>
      </div>
      <p className="max-w-3xl type-body text-muted-foreground">{body}</p>
    </div>
  );
}

function PhaseNav({
  onBack,
  backLabel = "Back",
  primary,
}: {
  onBack?: () => void;
  backLabel?: string;
  primary: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
    loading?: boolean;
    hint?: string;
  };
}) {
  return (
    <div className="flex flex-col items-start justify-between gap-3 border-t border-border pt-6 sm:flex-row sm:items-center">
      {onBack ? (
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
          {backLabel}
        </Button>
      ) : (
        <span />
      )}
      <div className="flex flex-col items-end gap-1">
        {primary.hint && (
          <span className="text-[11px] text-muted-foreground">{primary.hint}</span>
        )}
        <Button
          variant="primary"
          onClick={primary.onClick}
          disabled={primary.disabled}
          className="link-arrow min-w-[10rem] justify-center"
        >
          {primary.loading ? (
            <RefreshCw className="mr-2 h-3.5 w-3.5 animate-spin" />
          ) : (
            <ArrowRight className="ml-1.5 h-3.5 w-3.5 order-2" />
          )}
          {primary.label}
        </Button>
      </div>
    </div>
  );
}


function SummaryCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="space-y-1 border border-border bg-muted/20 p-4">
      <span className="type-label">{label}</span>
      <div className="text-xl font-semibold tabular-nums text-foreground">{value}</div>
      {hint && <span className="type-caption">{hint}</span>}
    </div>
  );
}
