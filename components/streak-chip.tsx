"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

// 5×4 dithered flame. Only the tip flickers between frames; the base stays put.
const FRAMES = [
  ["  .  ", " :*: ", ":*#*:", " ### "],
  [" .   ", " *:. ", ":*#*:", " ### "],
  ["   . ", " .:* ", ":*#*:", " ### "],
];

function AsciiFlame({ lit }: { lit: boolean }) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (!lit || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setFrame((f) => (f + 1) % FRAMES.length), 420);
    return () => clearInterval(id);
  }, [lit]);

  return (
    <pre
      aria-hidden
      className={cn(
        "m-0 select-none font-mono text-[5px] font-bold leading-[5px] tracking-[-0.5px]",
        lit ? "text-orange-500" : "text-muted-foreground/60"
      )}
    >
      {FRAMES[lit ? frame : 0].join("\n")}
    </pre>
  );
}

/** Top-bar streak chip: an ASCII flame that flickers once today's review is done. */
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
      <AsciiFlame lit={lit} />
      <span className="font-medium tabular-nums">{current}</span>
    </Link>
  );
}
