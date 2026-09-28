import React from "react";
import { cn } from "@/lib/utils";

/*
 * Pixel-art flame, 7×10. Legend:
 *   .  empty          r  deep base        o  orange
 *   y  amber          w  pale core        s  spark
 *   e  dither: orange / empty checker (soft edge)
 *   m  dither: orange / amber checker     h  dither: amber / core checker
 * Frames play as a sprite: the tip leans and sparks jump.
 */
const FRAMES = [
  [
    "...s...",
    "...o...",
    "..oo..s",
    "..omo..",
    ".eommoe",
    "eomhmoe",
    "omhwhmo",
    "omhwhmo",
    "eomhmoe",
    ".rooor.",
  ],
  [
    ".s.....",
    "..o....",
    "..oo...",
    ".omo..s",
    "eommoe.",
    "eomhmoe",
    "omhwhmo",
    "omhwhmo",
    "eomhmoe",
    ".rooor.",
  ],
  [
    ".....s.",
    "....o..",
    "s..oo..",
    "..omo..",
    ".eommoe",
    "eomhmoe",
    "omhwhmo",
    "omhwhmo",
    "eomhmoe",
    ".rooor.",
  ],
];
const SEQUENCE = [0, 1, 0, 2];
const W = 7;
const H = 10;

// Fixed fire palette: the theme's orange scale inverts in dark mode, fire shouldn't.
const COLOR = {
  r: "hsl(12 85% 40%)",
  o: "hsl(22 95% 52%)",
  y: "hsl(38 100% 58%)",
  w: "hsl(50 100% 86%)",
  s: "hsl(30 100% 68%)",
} as const;

function pixelColor(ch: string, x: number, y: number): string | null {
  const even = (x + y) % 2 === 0;
  switch (ch) {
    case "e":
      return even ? COLOR.o : null;
    case "m":
      return even ? COLOR.o : COLOR.y;
    case "h":
      return even ? COLOR.y : COLOR.w;
    case "r":
    case "o":
    case "y":
    case "w":
    case "s":
      return COLOR[ch];
    default:
      return null;
  }
}

function pixels(frame: string[], color: (ch: string, x: number, y: number) => string | null) {
  return frame.flatMap((row, y) =>
    [...row].flatMap((ch, x) => {
      const fill = color(ch, x, y);
      return fill ? [<rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={fill} />] : [];
    })
  );
}

/**
 * Streak flame. Lit: a dithered pixel flame that flickers frame by frame (first frame
 * only under reduced motion). Unlit: the same shape, checker-dithered in the text colour.
 * Size it in whole multiples of 7×10 (e.g. 14×20) so the pixels stay crisp.
 */
export function StreakFlame({ lit, className }: { lit: boolean; className?: string }) {
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      shapeRendering="crispEdges"
      aria-hidden
      className={cn("h-5 w-[14px] shrink-0", className)}
    >
      {lit ? (
        SEQUENCE.map((f, i) => (
          <g key={i} className="streak-flame-frame" style={{ animationDelay: `${-i * 300}ms` }}>
            {pixels(FRAMES[f], pixelColor)}
          </g>
        ))
      ) : (
        <g fill="currentColor">
          {pixels(FRAMES[0], (ch, x, y) => (ch !== "." && ch !== "s" && (x + y) % 2 === 0 ? "currentColor" : null))}
        </g>
      )}
    </svg>
  );
}
