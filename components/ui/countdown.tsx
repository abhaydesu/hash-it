"use client";

import { useEffect, useState } from "react";
import { formatCountdown } from "@/lib/dates";

/** Local date + countdown to an instant ("Mon 5 Oct · in 2d 5h"). Renders nothing until mounted (clock/locale differ on the server). */
export function Countdown({ to, showDate = true }: { to: number; showDate?: boolean }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  if (now == null) return null;

  const date = new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short" }).format(to);
  const left = to > now ? `in ${formatCountdown(to - now)}` : "now";
  return (
    <span className="tabular-nums">
      {showDate && `${date} · `}
      {left}
    </span>
  );
}
