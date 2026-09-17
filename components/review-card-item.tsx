"use client";

import { useState } from "react";
import { AlertTriangle, AlertCircle, HelpCircle, Clock, Check } from "lucide-react";
import { recordReviewAttempt } from "@/app/actions/entry-actions";
import { cn, safeHref } from "@/lib/utils";

interface ReviewQueueItem {
  entryId: string;
  problemId: string;
  title: string;
  number?: number | null;
  url: string;
  difficulty?: "EASY" | "MEDIUM" | "HARD" | null;
  platform: string;
  lapses: number;
  reps: number;
  mistake?: string | null;
  idea?: string | null;
  family?: string | null;
}

interface ReviewCardItemProps {
  item: ReviewQueueItem;
  onComplete: () => void;
}

export function ReviewCardItem({ item, onComplete }: ReviewCardItemProps) {
  const [minutes, setMinutes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{
    rating: string;
    nextDue: Date;
    family?: string | null;
    difficulty?: string | null;
  } | null>(null);

  const difficultyLabel =
    item.difficulty === "EASY" ? "Easy" : item.difficulty === "HARD" ? "Hard" : item.difficulty === "MEDIUM" ? "Medium" : null;

  const difficultyClass =
    item.difficulty === "EASY"
      ? "border-easy bg-easy text-background"
      : item.difficulty === "HARD"
      ? "border-hard bg-hard text-background"
      : "border-medium bg-medium text-background";

  const handleOutcome = async (
    status: "SOLVED_UNAIDED" | "SOLVED_WITH_HELP" | "ATTEMPTED_FAILED"
  ) => {
    const trimmedMinutes = minutes.trim();
    const parsedMinutes = trimmedMinutes === "" ? null : Number.parseInt(trimmedMinutes, 10);
    if (status !== "ATTEMPTED_FAILED" && parsedMinutes === null) {
      alert("Please enter the minutes spent before marking a problem as solved.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await recordReviewAttempt({
        entryId: item.entryId,
        status,
        minutes: parsedMinutes,
        usedHint: status === "SOLVED_WITH_HELP",
      });
      setResult({
        rating: res.rating,
        nextDue: new Date(res.nextDue),
        family: item.family,
        difficulty: difficultyLabel,
      });
      setTimeout(() => onComplete(), 2500);
    } catch (err) {
      console.error("Failed to record attempt", err);
      alert("Failed to record review. See console.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Post-submit confirmation (Section 4: reveal labels here) ──────────────
  if (result) {
    const daysUntil = Math.round(
      (result.nextDue.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    return (
      <div className="w-full border border-border bg-background p-4 sm:p-5 font-mono">
        <div className="space-y-2">
          <div className="text-sm font-semibold text-foreground font-sans tracking-tight">{item.title}</div>
          <div className="flex flex-wrap items-center gap-2 text-[11px] tabular-numbers text-muted-foreground  tracking-wider">
            <span>
              Next review in{" "}
              <span className="font-semibold text-easy">
                {daysUntil} day{daysUntil !== 1 ? "s" : ""}
              </span>
            </span>
            {result.family && (
              <>
                <span className="text-border">·</span>
                <span className="text-foreground">{result.family}</span>
              </>
            )}
            {result.difficulty && (
              <>
                <span className="text-border">·</span>
                <span className={cn("border px-1.5 py-0.5", difficultyClass)}>
                  {result.difficulty}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full border border-border bg-background">
      {/* Header — pattern & difficulty intentionally hidden pre-submit */}
      <div className="border-b border-border p-4 bg-muted/20 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1 tabular-numbers font-mono  tracking-wider">
            {item.number != null && <span>#{item.number}</span>}
            <span className="text-[10px] font-medium tracking-wider">{item.platform}</span>
            {item.lapses >= 3 && (
                <span className="flex items-center gap-1 border border-destructive bg-destructive/10 px-1.5 py-0.5 text-[10px] text-destructive ring-1 ring-destructive">
                <AlertTriangle className="h-3 w-3" /> Stuck problem
              </span>
            )}
          </div>
          <a
            href={safeHref(item.url) || `/problems/${item.entryId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-base font-semibold text-foreground hover:underline transition-colors font-sans tracking-tight"
          >
            {item.title}
          </a>
        </div>
      </div>

      <div className="p-4 sm:p-5 space-y-4 font-mono">
        {/* Leech: pin previous mistake */}
        {item.lapses >= 3 && item.mistake && (
          <div className="border border-destructive/30 bg-destructive/5 p-3">
            <h3 className="text-[11px] font-semibold text-destructive mb-1 flex items-center gap-1.5">
              <AlertCircle className="h-3.5 w-3.5" /> Previous mistake
            </h3>
            <div className="text-xs text-foreground/90 whitespace-pre-wrap leading-relaxed">{item.mistake}</div>
          </div>
        )}

        <div className="text-[11px] tracking-wide text-muted-foreground font-semibold">
          Solve this problem on {item.platform === "LEETCODE" ? "LeetCode" : item.platform}, then record your outcome.
        </div>

        <div className="space-y-3 pt-1">
          <div className="flex items-center gap-3">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <input
              type="number"
              min="0"
              placeholder="Minutes taken (required)"
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              className="w-full sm:w-60 border border-border bg-background px-3 py-1.5 text-xs tabular-numbers text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-foreground"
              disabled={isSubmitting}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
            <button
              type="button"
              onClick={() => handleOutcome("SOLVED_UNAIDED")}
              disabled={isSubmitting}
              className="flex items-center justify-center gap-2 bg-easy text-background hover:opacity-90 px-3 py-2 text-xs font-semibold tracking-wide transition-colors disabled:opacity-50"
            >
              <Check className="h-4 w-4" /> Solved cold
            </button>
            <button
              type="button"
              onClick={() => handleOutcome("SOLVED_WITH_HELP")}
              disabled={isSubmitting}
              className="flex items-center justify-center gap-2 bg-medium text-background hover:opacity-90 px-3 py-2 text-xs font-semibold tracking-wide transition-colors disabled:opacity-50"
            >
              <HelpCircle className="h-4 w-4" /> Used hint
            </button>
            <button
              type="button"
              onClick={() => handleOutcome("ATTEMPTED_FAILED")}
              disabled={isSubmitting}
              className="flex items-center justify-center gap-2 bg-destructive text-destructive-foreground hover:opacity-90 px-3 py-2 text-xs font-semibold tracking-wide transition-colors disabled:opacity-50"
            >
              <AlertCircle className="h-4 w-4" /> Failed / Saw solution
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
