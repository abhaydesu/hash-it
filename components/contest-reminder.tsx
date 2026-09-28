"use client";

import React, { useEffect, useState } from "react";
import { Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Contest } from "@/lib/contests";
import { formatCountdown } from "@/lib/dates";

const startFormat = new Intl.DateTimeFormat(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" });

/** Top-bar chip for the next LeetCode contest; shows "live" while one is running. */
export function ContestReminder({ contests, className }: { contests: Contest[]; className?: string }) {
  // Time-dependent text only renders after mount, so server and client HTML match.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const current = now == null ? contests[0] : contests.find((c) => c.startTime + c.durationMs > now);
  if (!current) return null;

  const live = now != null && now >= current.startTime;
  const countdown = now == null ? null : live ? formatCountdown(current.startTime + current.durationMs - now) : formatCountdown(current.startTime - now);
  // Before mount, no locale/timezone-dependent text: the server's would differ from the browser's.
  const label =
    now == null
      ? `Next LeetCode contest: ${current.title}`
      : live
        ? `${current.title} is live, ends in ${countdown}`
        : `${current.title} starts ${startFormat.format(current.startTime)}, in ${countdown}`;

  return (
    <a
      href={current.url}
      target="_blank"
      rel="noopener noreferrer"
      title={label}
      aria-label={label}
      className={cn(
        "pressable flex h-8 items-center gap-1.5 border px-2 text-xs transition-colors",
        live
          ? "border-orange-500 bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400"
          : "border-border bg-background text-muted-foreground hover:bg-muted/50 hover:text-foreground",
        className,
      )}
    >
      {live ? (
        <span className="relative flex h-2 w-2" aria-hidden>
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-500 opacity-60 motion-reduce:animate-none" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-orange-500" />
        </span>
      ) : (
        <Trophy className="h-3.5 w-3.5 shrink-0" aria-hidden />
      )}
      {countdown && (
        <span className="tabular-nums">
          {countdown}
        </span>
      )}
    </a>
  );
}
