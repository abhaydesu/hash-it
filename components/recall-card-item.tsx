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
      setTimeout(() => onComplete(), 600);
    } catch (err) {
      console.error("Failed to record recall", err);
      alert("Failed to record recall. See console.");
      setIsSubmitting(false);
      setRating(null);
    }
  };

  return (
    <div className="w-full border border-border bg-background">
      {/* Header */}
      <div className="border-b border-border p-4 bg-muted/20 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1 tabular-numbers font-mono  tracking-wider">
            {item.number != null && <span>#{item.number}</span>}
            <span className="flex items-center gap-1 border border-border bg-background px-1.5 py-0.5 text-[10px]">
              <Brain className="h-3 w-3" /> Quick recall
            </span>
          </div>
          <a
            href={item.url || `/problems/${item.entryId}`}
            target="_blank"
            rel="noreferrer"
            className="text-base font-semibold text-foreground hover:underline transition-colors font-sans tracking-tight"
          >
            {item.title}
          </a>
        </div>
      </div>

      <div className="p-4 sm:p-5 space-y-4 font-mono">
        {!submitted ? (
          /* Step 1: Write the approach */
          <form onSubmit={handleSubmitApproach} className="space-y-3">
            <p className="text-xs text-muted-foreground  tracking-wide">
              Without opening the problem, write the approach and the key invariant from memory.
            </p>
            <textarea
              value={approach}
              onChange={(e) => setApproach(e.target.value)}
              placeholder="e.g. Two pointers shrinking from both ends. Invariant: left < right always. Sort first..."
              rows={3}
              className="w-full border border-border bg-background p-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-foreground resize-y font-mono"
              autoFocus
            />
            <button
              type="submit"
              disabled={!approach.trim()}
              className="flex items-center gap-2 border border-border bg-background hover:bg-muted px-4 py-2 text-xs font-semibold text-foreground  tracking-wide transition-colors disabled:opacity-40"
            >
              <ChevronDown className="h-3.5 w-3.5" /> Show stored notes
            </button>
          </form>
        ) : (
          /* Step 2: Compare and rate */
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-border border border-border">
              {/* What they wrote */}
              <div className="bg-background flex flex-col">
                <div className="border-b border-border bg-muted/30 px-3 py-1.5 text-[10px]  font-semibold tracking-wider text-muted-foreground">
                  You wrote
                </div>
                <div className="p-3 text-xs text-foreground whitespace-pre-wrap min-h-[80px] leading-relaxed flex-grow">
                  {approach || <span className="text-muted-foreground italic">Nothing written.</span>}
                </div>
              </div>

              {/* Stored idea */}
              <div className="bg-background flex flex-col">
                <div className="border-b border-border bg-muted/30 px-3 py-1.5 text-[10px]  font-semibold tracking-wider text-muted-foreground">
                  Stored idea
                </div>
                <div className="p-3 text-xs text-foreground whitespace-pre-wrap min-h-[80px] leading-relaxed flex-grow">
                  {item.idea || <span className="text-muted-foreground italic">No notes saved for this problem.</span>}
                </div>
              </div>
            </div>

            <p className="text-[10px]  tracking-wide font-semibold text-muted-foreground">
              How well did it match?
            </p>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleRate("GOOD")}
                disabled={isSubmitting}
                className={`flex flex-col items-center gap-1 border px-3 py-2 text-xs font-medium  tracking-wider transition-colors disabled:opacity-50 ${
                  rating === "GOOD"
                    ? "border-easy bg-easy/20 text-easy ring-1 ring-easy"
                    : "border-border bg-background hover:bg-muted text-foreground"
                }`}
              >
                <Check className="h-4 w-4" />
                <span>Matched</span>
                <span className="text-[10px] opacity-70 font-sans tracking-normal capitalize mt-0.5">→ Good</span>
              </button>
              <button
                type="button"
                onClick={() => handleRate("HARD")}
                disabled={isSubmitting}
                className={`flex flex-col items-center gap-1 border px-3 py-2 text-xs font-medium  tracking-wider transition-colors disabled:opacity-50 ${
                  rating === "HARD"
                    ? "border-warning bg-warning/20 text-warning ring-1 ring-warning"
                    : "border-border bg-background hover:bg-muted text-foreground"
                }`}
              >
                <Minus className="h-4 w-4" />
                <span>Close</span>
                <span className="text-[10px] opacity-70 font-sans tracking-normal capitalize mt-0.5">→ Hard</span>
              </button>
              <button
                type="button"
                onClick={() => handleRate("AGAIN")}
                disabled={isSubmitting}
                className={`flex flex-col items-center gap-1 border px-3 py-2 text-xs font-medium  tracking-wider transition-colors disabled:opacity-50 ${
                  rating === "AGAIN"
                    ? "border-destructive bg-destructive/20 text-destructive ring-1 ring-destructive"
                    : "border-border bg-background hover:bg-muted text-foreground"
                }`}
              >
                <X className="h-4 w-4" />
                <span>Blank</span>
                <span className="text-[10px] opacity-70 font-sans tracking-normal capitalize mt-0.5">→ Re-solve</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
