"use client";

import React, { useMemo } from "react";
import { SolveStatus } from "@prisma/client";
import { Check, X, Minus, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DryRunRow } from "@/app/actions/import-actions";

export type OverrideMode = "CSV" | "ALL_COLD" | "ALL_HELP" | "PER_ROW";

const MODES: Array<{
  id: OverrideMode;
  label: string;
  hint: string;
  effect: string;
}> = [
  {
    id: "CSV",
    label: "Keep from CSV",
    hint: "Uses the Status column, if any.",
    effect: "Rows with a blank Status behave like cold — long intervals, late in the spread.",
  },
  {
    id: "ALL_COLD",
    label: "All Solved (cold)",
    hint: "Mark every row as unaided.",
    effect: "Starts on the long end of the curve. Rows land later in the 60-day spread.",
  },
  {
    id: "ALL_HELP",
    label: "All Solved with help",
    hint: "Mark every row as needing a hint.",
    effect: "Starts on the shorter end of the curve. Rows surface sooner in the spread.",
  },
  {
    id: "PER_ROW",
    label: "Classify per row",
    hint: "Click cold / help / failed on each.",
    effect: "Each row gets its own starting interval. Failed rows land first, then help, then cold.",
  },
];

export interface BulkStatusOverrideProps {
  rows: DryRunRow[];
  mode: OverrideMode;
  perRow: Record<number, SolveStatus>;
  onModeChange: (mode: OverrideMode) => void;
  onPerRowChange: (rowIndex: number, status: SolveStatus) => void;
}

export function BulkStatusOverride({
  rows,
  mode,
  perRow,
  onModeChange,
  onPerRowChange,
}: BulkStatusOverrideProps) {
  const perRowSummary = useMemo(() => {
    if (mode !== "PER_ROW") return null;
    let cold = 0;
    let help = 0;
    let failed = 0;
    for (const row of rows) {
      const s = perRow[row.rowIndex] ?? row.parsedStatus;
      if (s === SolveStatus.SOLVED_UNAIDED) cold++;
      else if (s === SolveStatus.SOLVED_WITH_HELP) help++;
      else failed++;
    }
    return { cold, help, failed, total: rows.length };
  }, [mode, rows, perRow]);

  return (
    <div className="space-y-4">
      <div>
        <span className="block font-semibold text-foreground">Status assignment</span>
        <span className="type-caption">
          Decide how each imported row is marked before it enters the review schedule.
        </span>
      </div>

      <div className="border border-border bg-muted/20 p-3 text-[11px] leading-relaxed text-muted-foreground">
        <span className="block font-medium text-foreground">
          How this shapes your queue
        </span>
        Every import is spread over the next ~60 days so the queue doesn&apos;t flood. Within that
        spread, <span className="font-mono">failed</span> rows come up first,{" "}
        <span className="font-mono">with-help</span> next, and <span className="font-mono">cold</span>{" "}
        rows sit at the back with the longest starting interval. Your choice below is the seed rating
        the scheduler uses for the first review.
      </div>

      <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-4">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => onModeChange(m.id)}
            className={cn(
              "flex flex-col items-start gap-1.5 border p-3 text-left text-xs transition-colors",
              mode === m.id
                ? "border-orange-500 bg-orange-500/5 text-foreground"
                : "border-border bg-background text-muted-foreground hover:bg-muted/40 hover:text-foreground"
            )}
            aria-pressed={mode === m.id}
          >
            <span className="font-medium text-foreground">{m.label}</span>
            <span className="type-caption">{m.hint}</span>
            <span
              className={cn(
                "mt-1 border-t border-border/70 pt-1.5 text-[10.5px] leading-snug",
                mode === m.id ? "text-foreground/80" : "text-muted-foreground/80"
              )}
            >
              {m.effect}
            </span>
          </button>
        ))}
      </div>

      {mode === "PER_ROW" && (
        <div className="space-y-3">
          {perRowSummary && (
            <div className="flex flex-wrap items-center gap-3 border border-border bg-muted/20 px-3 py-2 text-[11px] text-muted-foreground">
              <span>
                Classified: <span className="font-semibold text-foreground">{perRowSummary.total}</span>
              </span>
              <span className="text-easy">Cold {perRowSummary.cold}</span>
              <span className="text-warning">With help {perRowSummary.help}</span>
              <span className="text-destructive">Failed {perRowSummary.failed}</span>
            </div>
          )}

          <div className="max-h-[420px] overflow-y-auto border border-border bg-background">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 z-10 border-b border-border bg-muted/40 type-label text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">Problem</th>
                  <th className="px-3 py-2 text-right">Mark as</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((row) => {
                  const current = perRow[row.rowIndex] ?? row.parsedStatus;
                  return (
                    <tr key={row.rowIndex} className="hover:bg-muted/30">
                      <td className="px-3 py-2 tabular-nums text-muted-foreground">{row.rowIndex}</td>
                      <td
                        className="max-w-[320px] truncate px-3 py-2 font-medium text-foreground"
                        title={row.matchedTitle || row.rawName}
                      >
                        {row.matchedNumber != null && (
                          <span className="mr-1 text-muted-foreground">#{row.matchedNumber}</span>
                        )}
                        {row.matchedTitle || row.rawName}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-end gap-1">
                          <StatusButton
                            active={current === SolveStatus.SOLVED_UNAIDED}
                            onClick={() => onPerRowChange(row.rowIndex, SolveStatus.SOLVED_UNAIDED)}
                            label="Cold"
                            tone="good"
                            icon={<Check className="h-3 w-3" />}
                          />
                          <StatusButton
                            active={current === SolveStatus.SOLVED_WITH_HELP}
                            onClick={() => onPerRowChange(row.rowIndex, SolveStatus.SOLVED_WITH_HELP)}
                            label="Help"
                            tone="warn"
                            icon={<HelpCircle className="h-3 w-3" />}
                          />
                          <StatusButton
                            active={current === SolveStatus.ATTEMPTED_FAILED}
                            onClick={() => onPerRowChange(row.rowIndex, SolveStatus.ATTEMPTED_FAILED)}
                            label="Failed"
                            tone="bad"
                            icon={<X className="h-3 w-3" />}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-3 py-6 text-center text-muted-foreground">
                      <Minus className="mx-auto mb-1 h-4 w-4" />
                      No rows to classify.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusButton({
  active,
  onClick,
  label,
  tone,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  tone: "good" | "warn" | "bad";
  icon: React.ReactNode;
}) {
  const toneClass =
    tone === "good"
      ? "border-easy/60 bg-easy/10 text-easy"
      : tone === "warn"
        ? "border-warning/60 bg-warning/10 text-warning"
        : "border-destructive/60 bg-destructive/10 text-destructive";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1 border px-2 py-1 text-[11px] font-medium transition-colors",
        active
          ? toneClass
          : "border-border bg-background text-muted-foreground hover:bg-muted/40 hover:text-foreground"
      )}
    >
      {icon}
      {label}
    </button>
  );
}

/** Apply the chosen override mode to a copy of the rows before commit. */
export function applyStatusOverride(
  rows: DryRunRow[],
  mode: OverrideMode,
  perRow: Record<number, SolveStatus>
): DryRunRow[] {
  if (mode === "CSV") return rows;
  return rows.map((row) => {
    if (mode === "ALL_COLD") {
      return { ...row, parsedStatus: SolveStatus.SOLVED_UNAIDED };
    }
    if (mode === "ALL_HELP") {
      return { ...row, parsedStatus: SolveStatus.SOLVED_WITH_HELP };
    }
    const chosen = perRow[row.rowIndex];
    if (chosen) return { ...row, parsedStatus: chosen };
    return row;
  });
}
