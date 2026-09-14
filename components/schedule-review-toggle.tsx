"use client";

import { useState, useTransition } from "react";
import { Calendar, CheckCircle2, Clock } from "lucide-react";
import { toggleScheduleReview } from "@/app/actions/entry-actions";

interface ScheduleReviewToggleProps {
  entryId: string;
  initialScheduled: boolean;
}

export function ScheduleReviewToggle({ entryId, initialScheduled }: ScheduleReviewToggleProps) {
  const [isScheduled, setIsScheduled] = useState(initialScheduled);
  const [isPending, startTransition] = useTransition();

  const handleToggle = () => {
    const nextState = !isScheduled;
    setIsScheduled(nextState);
    startTransition(async () => {
      try {
        await toggleScheduleReview(entryId, nextState);
      } catch (err) {
        setIsScheduled(!nextState);
        console.error("Failed to toggle review schedule", err);
        alert("Failed to update review schedule.");
      }
    });
  };

  return (
    <button
      onClick={handleToggle}
      disabled={isPending}
      className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-mono transition-all disabled:opacity-50 ${
        isScheduled
          ? "border-emerald-700/60 bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/40"
          : "border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
      }`}
      title={isScheduled ? "Click to unschedule spaced reviews for this problem" : "Click to schedule spaced reviews for this problem"}
    >
      <Clock className="h-3.5 w-3.5" />
      <span>{isScheduled ? "Scheduled for Review" : "Schedule Reviews"}</span>
    </button>
  );
}
