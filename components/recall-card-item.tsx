"use client";
import React from 'react';

import { useState } from "react";
import { Brain } from "lucide-react";
import { recordRecallAttempt } from "@/app/actions/entry-actions";
import { safeHref } from "@/lib/utils";
import { Button } from "@/components/ui/button";

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
      setIsSubmitting(false);
      setRating(null);
    }
  };

  const href = safeHref(item.url) || `/problems/${item.entryId}`;

  return (
    <article className="border border-border bg-background">
      <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <div className="type-label mb-1 flex items-center gap-2 tabular-numbers">
            {item.number != null && <span>#{item.number}</span>}
            <span className="inline-flex items-center gap-1 text-foreground">
              <Brain className="h-3 w-3" /> Quick recall
            </span>
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
        {!submitted ? (
          <form onSubmit={handleSubmitApproach} className="space-y-3">
            <label className="type-label block">Write the approach from memory</label>
            <textarea
              value={approach}
              onChange={(e) => setApproach(e.target.value)}
              rows={4}
              placeholder="Key idea, structure, edge cases…"
              className="w-full border border-border bg-background p-3 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-orange-500 resize-y"
            />
            <Button type="submit" variant="primary" size="sm" disabled={!approach.trim()}>
              Check against notes
            </Button>
          </form>
        ) : (
          <div className="idea-preview space-y-4">
            <div className="grid grid-cols-1 gap-px border border-border bg-border sm:grid-cols-2">
              <div className="bg-background">
                <div className="type-label border-b border-border bg-muted/30 px-3 py-1.5">You wrote</div>
                <div className="p-3 text-sm font-mono whitespace-pre-wrap">{approach}</div>
              </div>
              <div className="bg-background">
                <div className="type-label border-b border-border bg-muted/30 px-3 py-1.5">Your notes</div>
                <div className="p-3 text-sm font-mono whitespace-pre-wrap text-muted-foreground">
                  {item.idea || "No idea notes logged."}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outcome-good"
                size="sm"
                disabled={isSubmitting}
                onClick={() => handleRate("GOOD")}
                className={rating === "GOOD" ? "ring-2 ring-orange-500" : undefined}
              >
                Matched
              </Button>
              <Button
                type="button"
                variant="outcome-hard"
                size="sm"
                disabled={isSubmitting}
                onClick={() => handleRate("HARD")}
                className={rating === "HARD" ? "ring-2 ring-orange-500" : undefined}
              >
                Close
              </Button>
              <Button
                type="button"
                variant="outcome-again"
                size="sm"
                disabled={isSubmitting}
                onClick={() => handleRate("AGAIN")}
                className={rating === "AGAIN" ? "ring-2 ring-orange-500" : undefined}
              >
                Blank
              </Button>
            </div>
          </div>
        )}
      </div>
    </article>
  );
}
