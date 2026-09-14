"use client";

import { useState } from "react";
import { Brain, Check, X, Minus, ChevronDown } from "lucide-react";
import { recordRecallAttempt } from "@/app/actions/entry-actions";

interface RecallCardItemProps {
  item: {
    entryId: string;
    title: string;
    number?: number | null;
    url: string;
    idea?: string | null;
  };
  onComplete: () => void;
}

export function RecallCardItem({ item, onComplete }: RecallCardItemProps) {
  const [approach, setApproach] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rating, setRating] = useState<"GOOD" | "HARD" | "AGAIN" | null>(null);

  const handleSubmitApproach = (e: React.FormEvent) => {
    e.preventDefault();
    if (!approach.trim()) return;
    setSubmitted(true);
  };

  const handleRate = async (r: "GOOD" | "HARD" | "AGAIN") => {
    setRating(r);
    setIsSubmitting(true);
    try {
      await recordRecallAttempt({
        entryId: item.entryId,
        rating: r,
        wroteApproach: approach.trim() || null,
      });
      // Brief pause so user sees the rating confirmation before card dismisses
      setTimeout(() => onComplete(), 600);
    } catch (err) {
      console.error("Failed to record recall", err);
      alert("Failed to record recall. See console.");
      setIsSubmitting(false);
      setRating(null);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto border border-zinc-800 bg-zinc-950 rounded-lg overflow-hidden animate-in fade-in duration-300">
      {/* Header */}
      <div className="border-b border-zinc-800 p-4 bg-zinc-900/40 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 font-mono text-xs text-zinc-400 mb-1">
            {item.number != null && <span>#{item.number}</span>}
            <span className="flex items-center gap-1 rounded bg-sky-950/60 border border-sky-800/50 px-1.5 py-0.5 text-[10px] text-sky-400">
              <Brain className="h-3 w-3" /> Quick recall
            </span>
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
      </div>

      <div className="p-5 space-y-5">
        {!submitted ? (
          /* Step 1: Write the approach */
          <form onSubmit={handleSubmitApproach} className="space-y-3">
            <p className="text-sm text-zinc-400">
              Without opening the problem, write the approach and the key invariant from memory.
            </p>
            <textarea
              value={approach}
              onChange={(e) => setApproach(e.target.value)}
              placeholder="e.g. Two pointers shrinking from both ends. Invariant: left < right always. Sort first..."
              rows={3}
              className="w-full rounded border border-zinc-800 bg-zinc-900/90 p-3 text-sm font-mono text-zinc-200 placeholder-zinc-600 focus:border-sky-500/80 focus:outline-none resize-y"
              autoFocus
            />
            <button
              type="submit"
              disabled={!approach.trim()}
              className="flex items-center gap-2 rounded border border-sky-700 bg-sky-950/60 px-4 py-2 text-sm font-medium text-sky-300 hover:bg-sky-900/60 transition-colors disabled:opacity-40"
            >
              <ChevronDown className="h-4 w-4" /> Show stored notes
            </button>
          </form>
        ) : (
          /* Step 2: Compare and rate */
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {/* What they wrote */}
              <div className="space-y-1.5">
                <div className="text-[10px] font-mono uppercase tracking-widest text-sky-400">You wrote</div>
                <div className="rounded border border-zinc-800 bg-zinc-900/70 p-3 text-xs font-mono text-zinc-200 whitespace-pre-wrap min-h-[80px] leading-relaxed">
                  {approach || <span className="text-zinc-600 italic">Nothing written.</span>}
                </div>
              </div>

              {/* Stored idea */}
              <div className="space-y-1.5">
                <div className="text-[10px] font-mono uppercase tracking-widest text-emerald-400">Stored idea</div>
                <div className="rounded border border-emerald-900/40 bg-emerald-950/20 p-3 text-xs font-mono text-zinc-200 whitespace-pre-wrap min-h-[80px] leading-relaxed">
                  {item.idea || <span className="text-zinc-600 italic">No notes saved for this problem.</span>}
                </div>
              </div>
            </div>

            <p className="text-xs text-zinc-500 font-mono">How well did it match?</p>

            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => handleRate("GOOD")}
                disabled={isSubmitting}
                className={`flex flex-col items-center gap-1.5 rounded border px-3 py-2.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                  rating === "GOOD"
                    ? "border-emerald-600 bg-emerald-950/60 text-emerald-300"
                    : "border-emerald-800 bg-emerald-950/30 text-emerald-400 hover:bg-emerald-900/40"
                }`}
              >
                <Check className="h-4 w-4" />
                <span>Matched</span>
                <span className="text-[10px] opacity-60">→ Good</span>
              </button>
              <button
                onClick={() => handleRate("HARD")}
                disabled={isSubmitting}
                className={`flex flex-col items-center gap-1.5 rounded border px-3 py-2.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                  rating === "HARD"
                    ? "border-amber-600 bg-amber-950/60 text-amber-300"
                    : "border-amber-800 bg-amber-950/30 text-amber-400 hover:bg-amber-900/40"
                }`}
              >
                <Minus className="h-4 w-4" />
                <span>Close</span>
                <span className="text-[10px] opacity-60">→ Hard</span>
              </button>
              <button
                onClick={() => handleRate("AGAIN")}
                disabled={isSubmitting}
                className={`flex flex-col items-center gap-1.5 rounded border px-3 py-2.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                  rating === "AGAIN"
                    ? "border-rose-600 bg-rose-950/60 text-rose-300"
                    : "border-rose-800 bg-rose-950/30 text-rose-400 hover:bg-rose-900/40"
                }`}
              >
                <X className="h-4 w-4" />
                <span>Blank</span>
                <span className="text-[10px] opacity-60">→ Re-solve</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
