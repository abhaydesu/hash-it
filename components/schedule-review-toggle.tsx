"use client";
import React from 'react';

import { useState, useTransition } from "react";
import { Clock } from "lucide-react";
import { toggleScheduleReview } from "@/app/actions/entry-actions";
import { useAlertDialog } from "@/components/ui/alert-dialog";

interface ScheduleReviewToggleProps {
  entryId: string;
  initialScheduled: boolean;
}

export function ScheduleReviewToggle({ entryId, initialScheduled }: ScheduleReviewToggleProps) {
  const [isScheduled, setIsScheduled] = useState(initialScheduled);
  const [isPending, startTransition] = useTransition();
  const { showAlert, alertDialog } = useAlertDialog();

  const handleToggle = () => {
    const nextState = !isScheduled;
    setIsScheduled(nextState);
    startTransition(async () => {
      try {
        await toggleScheduleReview(entryId, nextState);
      } catch (err) {
        setIsScheduled(!nextState);
        console.error("Failed to toggle review schedule", err);
        showAlert("Failed to update review schedule.");
      }
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={handleToggle}
        disabled={isPending}
        className={`pressable flex items-center gap-1.5 border px-2.5 py-1 text-xs font-medium disabled:opacity-50 ${
          isScheduled
            ? "border-easy/50 bg-easy/10 text-easy hover:bg-easy/20"
            : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
        }`}
        title={isScheduled ? "Click to unschedule spaced reviews for this problem" : "Click to schedule spaced reviews for this problem"}
      >
        <Clock className="h-3 w-3" />
        <span>{isScheduled ? "Scheduled for review" : "Schedule reviews"}</span>
      </button>
      {alertDialog}
    </>
  );
}
