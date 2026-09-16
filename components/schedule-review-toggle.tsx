"use client";

import { useState, useTransition } from "react";
import { Clock } from "lucide-react";
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
      type="button"
      onClick={handleToggle}
      disabled={isPending}
      className={`flex items-center gap-1.5 border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
        isScheduled
          ? "border-easy/50 bg-easy/10 text-easy hover:bg-easy/20"
          : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
      title={isScheduled ? "Click to unschedule spaced reviews for this problem" : "Click to schedule spaced reviews for this problem"}
    >
      <Clock className="h-3.5 w-3.5" />
      <span>{isScheduled ? "Scheduled for review" : "Schedule reviews"}</span>
    </button>
  );
}
