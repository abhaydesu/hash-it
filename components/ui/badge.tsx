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
    easy: "border border-easy/35 text-easy",
    medium: "border border-medium/35 text-medium",
    hard: "border border-hard/35 text-hard",
    "status-unaided": "border border-easy/35 text-easy",
    "status-help": "border border-border text-muted-foreground",
    "status-failed": "border border-destructive/40 text-destructive",
    overdue: "border border-warning/40 text-warning",
    recall: "border border-recall/35 text-recall",
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
