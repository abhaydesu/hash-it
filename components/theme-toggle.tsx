"use client";

import * as React from "react";
import { flushSync } from "react-dom";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

// Sun ↔ moon morph in plain CSS transforms (see `.theme-icon` in globals.css);
// the motion idea is inspired by xevrion/ui-lab's theme toggle. The icon's state is driven by
// the `.dark` class on <html>, not React state, so it is correct on first paint
// with no hydration flash.
//
// One disc does both jobs: scaled down it is the sun, full size it is the moon.
// A mask circle drops straight down from above to bite out the crescent, a ring
// of rays draws in under the disc one after another, and the whole icon tips
// clockwise so the crescent settles facing lower-left.
//
// Rays alternate long (cardinal) and short (diagonal) so the sun reads crisp
// at 16px rather than as a busy ring.
const RAYS = Array.from({ length: 8 }, (_, i) => ({ deg: i * 45, outer: i % 2 === 0 ? 10.5 : 9.5 }));

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const animTimer = React.useRef<number | undefined>(undefined);
  const maskId = `theme-bite-${React.useId().replace(/[^\w-]/g, "")}`;

  const toggle = (e: React.MouseEvent<HTMLButtonElement>) => {
    const next = resolvedTheme === "dark" ? "light" : "dark";
    const root = document.documentElement;
    const apply = () => {
      // Opt this switch into the icon morph; page loads stay static.
      root.setAttribute("data-theme-anim", "");
      window.clearTimeout(animTimer.current);
      animTimer.current = window.setTimeout(() => root.removeAttribute("data-theme-anim"), 700);
      flushSync(() => setTheme(next));
    };

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!document.startViewTransition || reduceMotion) {
      apply();
      return;
    }

    // The new theme spreads out in a circle from the button, reaching the
    // farthest corner of the viewport.
    const rect = e.currentTarget.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));

    const transition = document.startViewTransition(apply);
    transition.ready.then(() => {
      document.documentElement.animate(
        {
          clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`],
        },
        {
          duration: 520,
          easing: "cubic-bezier(0.65, 0, 0.35, 1)",
          pseudoElement: "::view-transition-new(root)",
        }
      );
    });
  };

  return (
    <button
      type="button"
      onClick={toggle}
      className={cn(
        "pressable relative inline-flex items-center justify-center border border-border bg-background text-muted-foreground hover:text-foreground hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        className
      )}
      title="Toggle theme"
      aria-label="Toggle theme"
    >
      <svg aria-hidden viewBox="0 0 24 24" className="theme-icon h-4 w-4">
        <defs>
          <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24">
            <rect width="24" height="24" fill="white" />
            <circle className="theme-icon-bite" cx="12" cy="12" r="7" fill="black" />
          </mask>
        </defs>
        <circle className="theme-icon-disc" cx="12" cy="12" r="8" fill="currentColor" mask={`url(#${maskId})`} />
        <g stroke="currentColor" strokeWidth={1.75} strokeLinecap="round">
          {RAYS.map(({ deg, outer }, i) => (
            // Outer <g> fixes the angle; the ray inside slides along it.
            <g key={deg} transform={`rotate(${deg} 12 12)`}>
              <line
                className="theme-icon-ray"
                x1={12 + 7.25}
                y1="12"
                x2={12 + outer}
                y2="12"
                style={{ "--i": i, "--r": RAYS.length - 1 - i } as React.CSSProperties}
              />
            </g>
          ))}
        </g>
      </svg>
    </button>
  );
}
