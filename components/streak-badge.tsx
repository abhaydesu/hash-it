import React from "react";
import { cn } from "@/lib/utils";
import { SpecCell } from "@/components/ui/spec-sheet";
import type { StreakStats } from "@/lib/stats-engine";

const days = (n: number) => `${n} ${n === 1 ? "day" : "days"}`;

export function StreakBadge({ streak, className }: { streak: StreakStats; className?: string }) {
  const { current, longest, activeDays, todayDone } = streak;
  const live = current > 0 && todayDone;

  const subvalue =
    current > 0 && !todayDone
      ? "Review today to keep it going"
      : longest > 0
        ? `Best ${days(longest)} · ${activeDays} active`
        : "Review a problem to start one";

  return (
    <SpecCell
      className={className}
      label="Practice streak"
      value={
        <span className={cn("flex items-center gap-1.5", live ? "text-orange-600 dark:text-orange-500" : current > 0 ? "text-foreground" : "text-muted-foreground")}>
          <span className="tabular-nums">{current}</span>
          <span className="text-sm font-normal text-muted-foreground">{current === 1 ? "day" : "days"}</span>
        </span>
      }
      subvalue={<span className={cn(current > 0 && !todayDone && "text-warning")}>{subvalue}</span>}
    />
  );
}
