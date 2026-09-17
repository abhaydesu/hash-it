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
  const styles: Record<NonNullable<BadgeProps["variant"]>, string> = {
    default: "border border-border text-foreground",
    outline: "border border-border text-foreground",
    pattern: "border border-border bg-muted/40 text-muted-foreground",
    flag: "border border-border text-foreground",
    easy: "border border-easy/50 bg-easy/20 text-easy",
    medium: "border border-medium/50 bg-medium/20 text-medium",
    hard: "border border-hard/50 bg-hard/20 text-hard",
    "status-unaided": "outcome-fill-good",
    "status-help": "outcome-fill-hint",
    "status-failed": "outcome-fill-failed",
    overdue: "border border-warning/50 bg-warning/20 text-warning",
    recall: "border border-recall/50 bg-recall/20 text-recall",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-1.5 py-0.5 text-[11px] font-medium tracking-tight",
        styles[variant],
        className
      )}
      {...props}
    />
  );
}

export { Badge };
