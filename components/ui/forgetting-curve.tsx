"use client";

import React, { useEffect, useRef, useState } from "react";

const DRAW_SECONDS = 2.4;
const REVIEW_XS = [64, 84, 126, 202, 340];

export function ForgettingCurveGraph() {
  const ref = useRef<SVGSVGElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const [visible, setVisible] = useState(false);
  const [dotDelays, setDotDelays] = useState<number[]>([]);

  // Time each dot to the moment the line reaches its review peak, so dots
  // pop in sync with the draw instead of on a fixed stagger.
  useEffect(() => {
    const path = pathRef.current;
    if (!path) return;
    const total = path.getTotalLength();
    const steps = 600;
    setDotDelays(
      REVIEW_XS.map((cx) => {
        for (let i = 0; i <= steps; i++) {
          const pt = path.getPointAtLength((i / steps) * total);
          if (pt.x >= cx - 0.5 && pt.y <= 11) return (i / steps) * DRAW_SECONDS;
        }
        return 0;
      })
    );
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <svg
      ref={ref}
      viewBox="0 0 480 240"
      className="w-full"
      role="img"
      aria-label="Forgetting curve graph showing how spaced repetition maintains recall over time"
    >
      <line x1="50" y1="10" x2="50" y2="190" stroke="hsl(var(--border))" strokeWidth="1" />
      <line x1="50" y1="190" x2="465" y2="190" stroke="hsl(var(--border))" strokeWidth="1" />

      <line x1="50" y1="55" x2="465" y2="55" stroke="hsl(var(--border))" strokeWidth="0.5" strokeDasharray="3,4" />
      <line x1="50" y1="100" x2="465" y2="100" stroke="hsl(var(--border))" strokeWidth="0.5" strokeDasharray="3,4" />
      <line x1="50" y1="145" x2="465" y2="145" stroke="hsl(var(--border))" strokeWidth="0.5" strokeDasharray="3,4" />

      <text x="44" y="15" textAnchor="end" fill="hsl(var(--muted-foreground))" fontSize="9">100%</text>
      <text x="44" y="103" textAnchor="end" fill="hsl(var(--muted-foreground))" fontSize="9">50%</text>
      <text x="44" y="194" textAnchor="end" fill="hsl(var(--muted-foreground))" fontSize="9">0%</text>

      <text x="50" y="206" textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize="9">0</text>
      <text x="188" y="206" textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize="9">20</text>
      <text x="326" y="206" textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize="9">40</text>
      <text x="465" y="206" textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize="9">60d</text>

      {/* Without review — smooth decay (gray dashed) */}
      <path
        d="M50,10 C80,10 110,80 160,130 S300,178 465,185"
        fill="none"
        stroke="hsl(var(--muted-foreground))"
        strokeWidth="1.5"
        strokeDasharray="5,4"
        opacity="0.45"
      />

      {/* With review — smooth curves (orange solid) */}
      <path
        d="M50,10 Q57,45 64,72 L64,10 Q74,50 84,78 L84,10 Q105,55 126,85 L126,10 Q164,48 202,75 L202,10 Q271,42 340,65 L340,10 Q402,32 465,50"
        fill="none"
        stroke="hsl(var(--orange-500))"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        ref={pathRef}
        pathLength={1}
        className={visible ? "forgetting-curve-draw" : ""}
        style={{
          strokeDasharray: 1,
          strokeDashoffset: 1,
          animationDuration: `${DRAW_SECONDS}s`,
        }}
      />

      {/* Review dots */}
      {REVIEW_XS.map((cx, i) => (
        <circle
          key={cx}
          cx={cx}
          cy="10"
          r="3"
          fill="hsl(var(--orange-500))"
          className={visible ? "forgetting-dot-pop" : ""}
          style={{
            opacity: 0,
            animationDelay: visible ? `${dotDelays[i] ?? 0}s` : undefined,
          }}
        />
      ))}

      {/* Legend */}
      <line x1="50" y1="226" x2="65" y2="226" stroke="hsl(var(--muted-foreground))" strokeWidth="1.5" strokeDasharray="4,3" opacity="0.5" />
      <text x="70" y="229" fill="hsl(var(--muted-foreground))" fontSize="9">Without review</text>

      <line x1="195" y1="226" x2="210" y2="226" stroke="hsl(var(--orange-500))" strokeWidth="2" />
      <circle cx="203" cy="226" r="2.5" fill="hsl(var(--orange-500))" />
      <text x="216" y="229" fill="hsl(var(--muted-foreground))" fontSize="9">With spaced review</text>
    </svg>
  );
}
