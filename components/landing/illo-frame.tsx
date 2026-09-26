"use client";

import React, { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import "./illustrations.css";

/** Plays its looping SVG animations only while on screen. */
export function IlloFrame({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [play, setPlay] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setPlay(entry.isIntersecting), {
      rootMargin: "80px",
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      role="img"
      aria-label={label}
      data-play={play || undefined}
      className={cn("illo", className)}
    >
      {children}
    </div>
  );
}
