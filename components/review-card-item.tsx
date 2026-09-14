"use client";

import { useState } from "react";
import { CheckCircle, AlertTriangle, AlertCircle, HelpCircle, Clock, Check } from "lucide-react";
import { formatDifficulty } from "@/lib/utils";
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
}

interface ReviewCardItemProps {
  item: ReviewQueueItem;
  onComplete: () => void;
}

export function ReviewCardItem({ item, onComplete }: ReviewCardItemProps) {
  const [minutes, setMinutes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const diff = formatDifficulty(item.difficulty);

  const handleOutcome = async (
    status: "SOLVED_UNAIDED" | "SOLVED_WITH_HELP" | "ATTEMPTED_FAILED"
  ) => {
    setIsSubmitting(true);
    try {
      await recordReviewAttempt({
        entryId: item.entryId,
        status,
        minutes: minutes ? parseInt(minutes, 10) : undefined,
        usedHint: status === "SOLVED_WITH_HELP",
      });
      onComplete();
    } catch (err) {
      console.error("Failed to record attempt", err);
      alert("Failed to record review. See console.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto border border-zinc-800 bg-zinc-950 rounded-lg overflow-hidden animate-in fade-in duration-300">
      {/* Header */}
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
        <span className={`inline-block rounded border px-2 py-0.5 text-xs font-mono ${diff.className}`}>
          {diff.label}
        </span>
      </div>

      <div className="p-5 space-y-5">
        {/* If Leech, pin previous mistake per spec §7 */}
        {item.lapses >= 3 && item.mistake && (
          <div className="rounded-md border border-rose-900/50 bg-rose-950/30 p-3">
            <h3 className="text-[10px] font-mono font-semibold uppercase tracking-wider text-rose-500 mb-1.5 flex items-center gap-1.5">
              <AlertCircle className="h-3 w-3" /> Previous Mistake (Leech Warning)
            </h3>
            <div className="text-sm font-mono text-rose-200/90 whitespace-pre-wrap">
              {item.mistake}
            </div>
          </div>
        )}

        <div className="text-sm font-sans text-zinc-400">
          Solve this problem on {item.platform === "LEETCODE" ? "LeetCode" : item.platform}, then record your outcome.
        </div>

        {/* Input */}
        <div className="space-y-4 pt-2">
          <div className="flex items-center gap-3">
            <Clock className="h-4 w-4 text-zinc-500" />
            <input
              type="number"
              min="0"
              placeholder="Minutes taken"
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              className="w-32 rounded border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-sm font-mono text-zinc-100 placeholder-zinc-600 focus:border-emerald-500 focus:outline-none"
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
