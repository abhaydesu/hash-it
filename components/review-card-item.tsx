"use client";

import { useState } from "react";
import { AlertTriangle, AlertCircle, HelpCircle, Clock, Check } from "lucide-react";
import { recordReviewAttempt } from "@/app/actions/entry-actions";
import { formatDifficulty, safeHref } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

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
    item.difficulty === "EASY"
      ? "Easy"
      : item.difficulty === "HARD"
        ? "Hard"
        : item.difficulty === "MEDIUM"
          ? "Medium"
          : null;

  const handleOutcome = async (status: "SOLVED_UNAIDED" | "SOLVED_WITH_HELP" | "ATTEMPTED_FAILED") => {
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

  if (result) {
    const daysUntil = Math.round((result.nextDue.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    const diff = formatDifficulty(item.difficulty);
    return (
      <article className="border border-border bg-background p-4 sm:p-5">
        <div className="type-heading text-foreground">{item.title}</div>
        <p className="mt-2 type-caption">
          Next review in{" "}
          <span className="font-semibold text-foreground tabular-numbers">
            {daysUntil} day{daysUntil !== 1 ? "s" : ""}
          </span>
          {result.family ? `. Pattern family: ${result.family}` : ""}
          {result.difficulty ? `. Difficulty: ${result.difficulty}` : ""}.
        </p>
        {result.difficulty && (
          <div className="mt-2">
            <Badge variant={diff.variant}>{diff.label}</Badge>
          </div>
        )}
      </article>
    );
  }

  const href = safeHref(item.url) || `/problems/${item.entryId}`;

  return (
    <article className="border border-border bg-background">
      <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <div className="type-label mb-1 flex flex-wrap items-center gap-2 tabular-numbers">
            {item.number != null && <span>#{item.number}</span>}
            <span>{item.platform === "LEETCODE" ? "LeetCode" : item.platform}</span>
            {item.lapses >= 3 && (
              <Badge variant="overdue" className="gap-1">
                <AlertTriangle className="h-3 w-3" /> Stuck
              </Badge>
            )}
          </div>
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="type-heading text-foreground hover:text-orange-600 transition-colors"
          >
            {item.title}
          </a>
        </div>
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        {item.lapses >= 3 && item.mistake && (
          <div className="border-l-2 border-warning bg-muted/30 px-3 py-2">
            <div className="type-label mb-1 flex items-center gap-1.5 text-warning">
              <AlertCircle className="h-3.5 w-3.5" /> Previous mistake
            </div>
            <div className="text-sm font-mono whitespace-pre-wrap leading-relaxed text-foreground">
              {item.mistake}
            </div>
          </div>
        )}

        <p className="type-caption">
          Solve this problem on {item.platform === "LEETCODE" ? "LeetCode" : item.platform}, then record
          your outcome.
        </p>

        <div className="flex items-center gap-3">
          <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            type="number"
            min="0"
            placeholder="Minutes taken"
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            className="w-full max-w-xs border border-border bg-background px-3 py-1.5 text-sm tabular-numbers text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-orange-500"
            disabled={isSubmitting}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outcome-good"
            size="sm"
            disabled={isSubmitting}
            onClick={() => handleOutcome("SOLVED_UNAIDED")}
          >
            <Check className="h-3.5 w-3.5" /> Solved cold
          </Button>
          <Button
            type="button"
            variant="outcome-hard"
            size="sm"
            disabled={isSubmitting}
            onClick={() => handleOutcome("SOLVED_WITH_HELP")}
          >
            <HelpCircle className="h-3.5 w-3.5" /> Used hint
          </Button>
          <Button
            type="button"
            variant="outcome-failed"
            size="sm"
            disabled={isSubmitting}
            onClick={() => handleOutcome("ATTEMPTED_FAILED")}
          >
            <AlertCircle className="h-3.5 w-3.5" /> Failed
          </Button>
        </div>
      </div>
    </article>
  );
}
