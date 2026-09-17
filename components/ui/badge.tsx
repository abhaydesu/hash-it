import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?:
    | "default"
    | "outline"
    | "pattern"
    | "flag"
    | "easy"
    | "medium"
    | "hard"
    | "status-unaided"
    | "status-help"
    | "status-failed"
    | "overdue"
    | "recall";
}

/**
 * Quiet semantic badges. Difficulty uses coloured text + hairline, never large fills.
 * Orange is never a badge colour — it is reserved for interaction chrome.
 */
function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-1.5 py-0.5 text-[11px] font-medium tracking-tight",
        {
          "border border-border text-foreground": variant === "default" || variant === "outline",
          "border border-border bg-muted/40 text-muted-foreground": variant === "pattern",
          "border border-border text-foreground": variant === "flag",
          "border border-easy/35 text-easy": variant === "easy",
          "border border-medium/35 text-medium": variant === "medium",
          "border border-hard/35 text-hard": variant === "hard",
          "border border-easy/35 text-easy": variant === "status-unaided",
          "border border-border text-muted-foreground": variant === "status-help",
          "border border-destructive/40 text-destructive": variant === "status-failed",
          "border border-warning/40 text-warning": variant === "overdue",
          "border border-recall/35 text-recall": variant === "recall",
        },
        className
      )}
      {...props}
    />
  );
}

export { Badge };
