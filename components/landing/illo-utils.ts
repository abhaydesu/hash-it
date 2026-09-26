import type React from "react";

/** Timing vars for `[data-a]` animations: `t` = cycle length, `d` = delay (seconds). */
export function timing(t: number, d = 0, extra?: React.CSSProperties): React.CSSProperties {
  return { "--t": `${t}s`, "--d": `${d}s`, ...extra } as React.CSSProperties;
}

