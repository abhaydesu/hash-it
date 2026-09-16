import * as React from "react"
import { cn } from "@/lib/utils"

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "outline" | "easy" | "medium" | "hard" | "failed" | "overdue" | "recall"
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center px-2 py-0.5 text-xs font-semibold transition-colors border",
        {
          "border-transparent bg-primary text-primary-foreground": variant === "default",
          "border-transparent bg-muted text-muted-foreground": variant === "secondary",
          "text-foreground border-border": variant === "outline",
          "border-transparent bg-easy/10 text-easy": variant === "easy",
          "border border-medium/40 text-medium": variant === "medium",
          "border-transparent bg-hard/10 text-hard": variant === "hard",
          "border-transparent bg-destructive/10 text-destructive": variant === "failed",
          "border-transparent bg-warning/10 text-warning": variant === "overdue",
          "border-transparent bg-recall/10 text-recall": variant === "recall",
        },
        className
      )}
      {...props}
    />
  )
}

export { Badge }
