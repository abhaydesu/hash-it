"use client";

import { Plus } from "lucide-react";

export function TodayPageActions({ compact = false }: { compact?: boolean }) {
  const openLogProblem = () => {
    window.dispatchEvent(new CustomEvent("open-command-bar"));
  };

  if (compact) {
    return (
      <button
        type="button"
        onClick={openLogProblem}
        className="flex w-full items-center justify-between rounded-xl border border-border bg-background/60 px-3 py-3 text-left text-sm text-foreground hover:bg-muted"
      >
        <span>Log a new problem</span>
        <Plus className="h-4 w-4" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={openLogProblem}
      className="inline-flex items-center justify-center gap-2 rounded-xl bg-foreground px-4 py-2.5 text-sm font-medium text-background active:scale-[0.98]"
    >
      <Plus className="h-4 w-4" />
      Add problem
    </button>
  );
}
