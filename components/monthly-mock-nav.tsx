"use client";

import * as React from "react";
import Link from "next/link";
import { Pause, Play, Trash2, Timer } from "lucide-react";
import { formatMockClock, useMonthlyMock } from "@/components/monthly-mock-provider";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

export function MonthlyMockNavControls() {
  const { isActive, phase, elapsedSeconds, pause, resume, discard, currentIndex, problems } =
    useMonthlyMock();

  const [showConfirm, setShowConfirm] = React.useState(false);

  if (!isActive) return null;

  const paused = phase === "paused";

  return (
    <>
      <div className="flex h-8 items-center gap-1.5 border border-border bg-background pl-2 pr-1">
        <Link
          href="/review/monthly"
          className="pressable flex items-center gap-1.5 text-xs text-foreground hover:text-orange-600"
          title="Return to monthly mock"
        >
          <Timer className={`h-3.5 w-3.5 ${paused ? "text-muted-foreground" : "animate-pulse text-orange-600"}`} />
          <span className="font-semibold tabular-nums">{formatMockClock(elapsedSeconds)}</span>
          <span className="hidden text-muted-foreground sm:inline">
            · {currentIndex + 1}/{problems.length}
            {paused ? " · paused" : ""}
          </span>
        </Link>

        <button
          type="button"
          onClick={() => (paused ? resume() : pause())}
          className="pressable inline-flex h-6 w-6 items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground"
          title={paused ? "Resume mock" : "Pause mock"}
          aria-label={paused ? "Resume mock" : "Pause mock"}
        >
          {paused ? <Play className="h-3.5 w-3.5 fill-current" /> : <Pause className="h-3.5 w-3.5" />}
        </button>

        <button
          type="button"
          onClick={() => setShowConfirm(true)}
          className="pressable inline-flex h-6 w-6 items-center justify-center text-muted-foreground hover:bg-hard/10 hover:text-hard"
          title="Discard mock"
          aria-label="Discard mock"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      <ConfirmDialog
        isOpen={showConfirm}
        onOpenChange={setShowConfirm}
        title="Discard progress?"
        description="Are you sure you want to end this monthly mock? Your progress will be lost."
        confirmText="Discard"
        cancelText="Cancel"
        onConfirm={discard}
      />
    </>
  );
}
