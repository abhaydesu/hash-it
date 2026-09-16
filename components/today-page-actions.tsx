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
        className="flex w-full items-center justify-between border border-border bg-background px-3 py-2.5 text-left text-xs sm:text-sm text-foreground hover:bg-muted transition-colors"
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
      className="inline-flex items-center justify-center gap-2 border border-primary bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
    >
      <Plus className="h-3.5 w-3.5" />
      <span>Add problem</span>
    </button>
  );
}
