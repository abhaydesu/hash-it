"use client";

import React, { useEffect, useState, useTransition } from "react";
import type { ReactNode } from "react";
import { AlertCircle, Check, HelpCircle } from "lucide-react";
import { recordReviewAttempt } from "@/app/actions/entry-actions";
import { openLogProblem } from "@/lib/log-problem";
import type { PlanItemView, PlanKind } from "@/lib/weekly-review";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const PLAN_KIND_LABEL: Record<PlanKind, { short: string; title: string }> = {
  REDO: { short: "Redo", title: "Redo a stuck problem" },
  FRESH: { short: "New", title: "Try an unseen problem" },
  REVISIT: { short: "Revisit", title: "Revisit an old one" },
};

function OutcomeForm({ item, onDone }: { item: PlanItemView; onDone: () => void }) {
  const [minutes, setMinutes] = useState("");
  const [minutesMissing, setMinutesMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const submit = (status: "SOLVED_UNAIDED" | "SOLVED_WITH_HELP" | "ATTEMPTED_FAILED") => {
    if (!item.entryId) return;
    const parsed = minutes.trim() === "" ? null : Number.parseInt(minutes, 10);
    if (status !== "ATTEMPTED_FAILED" && parsed === null) {
      setMinutesMissing(true);
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await recordReviewAttempt({
          entryId: item.entryId!,
          status,
          minutes: parsed,
          usedHint: status === "SOLVED_WITH_HELP",
        });
        onDone();
      } catch {
        setError("Couldn't save that. Try again.");
      }
    });
  };

  return (
    <div className="space-y-2">
      <input
        type="number"
        min="0"
        placeholder="Minutes taken"
        value={minutes}
        onChange={(e) => {
          setMinutes(e.target.value);
          if (e.target.value.trim()) setMinutesMissing(false);
        }}
        aria-invalid={minutesMissing || undefined}
        className={cn(
          "w-full max-w-[10rem] border bg-background px-2.5 py-1 text-xs tabular-nums text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-orange-500",
          minutesMissing ? "border-warning" : "border-border",
        )}
        disabled={isPending}
      />
      {minutesMissing && <p className="text-[10px] text-warning">Enter minutes spent to mark as solved.</p>}
      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
        <Button
          type="button"
          variant="outcome-good"
          size="sm"
          disabled={isPending}
          onClick={() => submit("SOLVED_UNAIDED")}
          className="w-full justify-center"
        >
          <Check className="h-3.5 w-3.5" /> Solved cold
        </Button>
        <Button
          type="button"
          variant="outcome-hard"
          size="sm"
          disabled={isPending}
          onClick={() => submit("SOLVED_WITH_HELP")}
          className="w-full justify-center"
        >
          <HelpCircle className="h-3.5 w-3.5" /> Used hint
        </Button>
        <Button
          type="button"
          variant="outcome-failed"
          size="sm"
          disabled={isPending}
          onClick={() => submit("ATTEMPTED_FAILED")}
          className="w-full justify-center"
        >
          <AlertCircle className="h-3.5 w-3.5" /> Saw solution
        </Button>
      </div>
      {error && <p className="text-[10px] text-destructive">{error}</p>}
    </div>
  );
}

export function WeeklyPlanItems({
  items,
  compact = false,
  extraDoneIds,
  renderProblem,
  onReviewed,
}: {
  items: PlanItemView[];
  compact?: boolean;
  extraDoneIds?: Set<string>;
  renderProblem: (item: PlanItemView, done: boolean) => ReactNode;
  onReviewed?: (entryId: string) => void;
}) {
  const [doneIds, setDoneIds] = useState(() => new Set(items.filter((i) => i.done).map((i) => i.problemId)));
  const [recording, setRecording] = useState<PlanKind | null>(null);

  useEffect(() => {
    setDoneIds(new Set(items.filter((i) => i.done).map((i) => i.problemId)));
  }, [items]);

  useEffect(() => {
    const onLogged = (e: Event) => {
      const id = (e as CustomEvent<{ problemId?: string }>).detail?.problemId;
      if (id) setDoneIds((prev) => new Set([...prev, id]));
    };
    window.addEventListener("problem-logged", onLogged);
    return () => window.removeEventListener("problem-logged", onLogged);
  }, []);

  const isDone = (item: PlanItemView) =>
    !!(item.done || doneIds.has(item.problemId) || (item.entryId != null && extraDoneIds?.has(item.entryId)));

  return (
    <>
      {items.map((item) => {
        const done = isDone(item);
        const showForm = !done && item.kind !== "FRESH" && item.entryId != null && (!compact || recording === item.kind);
        return (
          <div key={item.kind} className={cn(compact ? "space-y-2" : "space-y-3 p-3 sm:p-4")}>
            <div className={cn("flex items-center justify-between gap-3", compact && "gap-2")}>
              <div className={cn("min-w-0", compact ? "flex flex-1 items-center gap-2 text-xs" : "space-y-0.5")}>
                <div className={cn("type-label text-muted-foreground", compact && "w-14 shrink-0")}>
                  {compact ? PLAN_KIND_LABEL[item.kind].short : PLAN_KIND_LABEL[item.kind].title}
                </div>
                {renderProblem(item, done)}
              </div>
              {done ? (
                <span className="flex shrink-0 items-center gap-1 text-xs text-easy">
                  <Check className="h-3.5 w-3.5" /> {compact ? null : "Done"}
                </span>
              ) : item.kind === "FRESH" ? (
                <Button
                  variant={compact ? "ghost" : "secondary"}
                  size="sm"
                  onClick={() =>
                    openLogProblem({
                      id: item.problemId,
                      title: item.title,
                      number: item.number,
                      url: item.url,
                      difficulty: item.difficulty,
                    })
                  }
                >
                  Log
                </Button>
              ) : compact && !showForm && item.entryId ? (
                <Button variant="ghost" size="sm" onClick={() => setRecording(item.kind)}>
                  Record
                </Button>
              ) : (
                !showForm && <span className="shrink-0 text-xs text-muted-foreground">To do</span>
              )}
            </div>
            {showForm && (
              <OutcomeForm
                item={item}
                onDone={() => {
                  setDoneIds((prev) => new Set([...prev, item.problemId]));
                  setRecording(null);
                  if (item.entryId) onReviewed?.(item.entryId);
                }}
              />
            )}
          </div>
        );
      })}
    </>
  );
}
