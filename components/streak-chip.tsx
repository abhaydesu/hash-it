import React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { StreakFlame } from "@/components/ui/streak-flame";

/** Top-bar streak chip: the flame lights (and flickers) once today's review is done. */
export function StreakChip({ current, todayDone }: { current: number; todayDone: boolean }) {
  const lit = current > 0 && todayDone;
  const label =
    current === 0
      ? "No streak yet — review a problem to start one"
      : `${current}-day streak${todayDone ? "" : " · review today to keep it"}`;

  return (
    <Link
      href="/stats"
      title={label}
      aria-label={label}
      className={cn(
        "pressable flex h-8 items-center gap-1.5 border border-border bg-background px-2 text-xs hover:bg-muted/50",
        lit ? "text-foreground" : "text-muted-foreground"
      )}
    >
      <StreakFlame lit={lit} className={lit ? undefined : "text-muted-foreground"} />
      <span className="font-medium tabular-nums">{current}</span>
    </Link>
  );
}
