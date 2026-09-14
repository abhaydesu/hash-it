"use client";

import { useState } from "react";
import { AlertTriangle, AlertCircle, HelpCircle, Clock, Check } from "lucide-react";
import { recordReviewAttempt } from "@/app/actions/entry-actions";
import { cn } from "@/lib/utils";

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
  // family is intentionally omitted here — hidden pre-submit per Section 4
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
      ? "border-emerald-600/60 text-emerald-400"
      : item.difficulty === "HARD"
      ? "border-rose-600/60 text-rose-400"
      : "border-amber-600/60 text-amber-400";

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
      // Let user read the post-submit confirmation, then dismiss
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
      <div className="w-full max-w-2xl mx-auto border border-zinc-800 bg-zinc-950 rounded-lg overflow-hidden animate-in fade-in duration-300">
        <div className="p-5 space-y-2">
          <div className="text-sm font-medium text-zinc-100">{item.title}</div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-zinc-400">
            <span>
              Next review in <span className="text-emerald-400 font-semibold">{daysUntil} day{daysUntil !== 1 ? "s" : ""}</span>
            </span>
            {result.family && (
              <>
                <span className="text-zinc-700">·</span>
                <span className="text-sky-400">{result.family}</span>
              </>
            )}
            {result.difficulty && (
              <>
                <span className="text-zinc-700">·</span>
                <span className={cn("rounded border px-1.5 py-0.5", difficultyClass)}>{result.difficulty}</span>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto border border-zinc-800 bg-zinc-950 rounded-lg overflow-hidden animate-in fade-in duration-300">
      {/* Header — no pattern label or difficulty shown pre-submit (Section 4) */}
      <div className="border-b border-zinc-800 p-4 bg-zinc-900/40 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 font-mono text-xs text-zinc-400 mb-1">
            {item.number != null && <span>#{item.number}</span>}
            <span className="uppercase">{item.platform}</span>
            {item.lapses >= 3 && (
              <span className="flex items-center gap-1 rounded bg-rose-950/80 border border-rose-800/50 px-1.5 py-0.2 text-[10px] text-rose-400">
                <AlertTriangle className="h-3 w-3" /> Leech
              </span>
            )}
          </div>
          <a
            href={item.url || `/problems/${item.entryId}`}
            target="_blank"
            rel="noreferrer"
            className="text-lg font-bold text-zinc-100 hover:text-emerald-400 transition-colors"
          >
            {item.title}
          </a>
        </div>
        {/* difficulty badge intentionally omitted here — shown post-submit */}
      </div>

      <div className="p-5 space-y-5">
        {/* Leech: pin previous mistake */}
        {item.lapses >= 3 && item.mistake && (
          <div className="rounded-md border border-rose-900/50 bg-rose-950/30 p-3">
            <h3 className="text-[10px] font-mono font-semibold uppercase tracking-wider text-rose-500 mb-1.5 flex items-center gap-1.5">
              <AlertCircle className="h-3 w-3" /> Previous Mistake (Leech Warning)
            </h3>
            <div className="text-sm font-mono text-rose-200/90 whitespace-pre-wrap">{item.mistake}</div>
          </div>
        )}

        <div className="text-sm font-sans text-zinc-400">
          Solve this problem on {item.platform === "LEETCODE" ? "LeetCode" : item.platform}, then record your outcome.
        </div>

        <div className="space-y-4 pt-2">
          <div className="flex items-center gap-3">
            <Clock className="h-4 w-4 text-zinc-500" />
            <input
              type="number"
              min="0"
              placeholder="Minutes taken (required)"
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              className="w-40 rounded border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-sm font-mono text-zinc-100 placeholder-zinc-600 focus:border-emerald-500 focus:outline-none"
              disabled={isSubmitting}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2">
            <button
              onClick={() => handleOutcome("SOLVED_UNAIDED")}
              disabled={isSubmitting}
              className="flex items-center justify-center gap-2 rounded border border-emerald-800 bg-emerald-950/50 hover:bg-emerald-900 px-4 py-2.5 text-sm font-medium text-emerald-300 transition-colors disabled:opacity-50"
            >
              <Check className="h-4 w-4" /> Solved Cold
            </button>
            <button
              onClick={() => handleOutcome("SOLVED_WITH_HELP")}
              disabled={isSubmitting}
              className="flex items-center justify-center gap-2 rounded border border-sky-800 bg-sky-950/50 hover:bg-sky-900 px-4 py-2.5 text-sm font-medium text-sky-300 transition-colors disabled:opacity-50"
            >
              <HelpCircle className="h-4 w-4" /> Used Hint
            </button>
            <button
              onClick={() => handleOutcome("ATTEMPTED_FAILED")}
              disabled={isSubmitting}
              className="flex items-center justify-center gap-2 rounded border border-rose-800 bg-rose-950/50 hover:bg-rose-900 px-4 py-2.5 text-sm font-medium text-rose-300 transition-colors disabled:opacity-50"
            >
              <AlertCircle className="h-4 w-4" /> Failed / Saw Solution
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
