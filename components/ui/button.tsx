import * as React from "react"
import { cn } from "@/lib/utils"

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "easy" | "medium" | "hard" | "failed"
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 h-9 px-4 py-2",
          {
            "bg-primary text-primary-foreground hover:bg-primary/90": variant === "primary",
            "border border-border bg-background hover:bg-muted text-foreground": variant === "secondary",
            "hover:bg-muted text-foreground": variant === "ghost",
            "bg-easy text-background hover:opacity-90": variant === "easy",
            "bg-medium text-background hover:opacity-90": variant === "medium",
            "bg-hard text-background hover:opacity-90": variant === "hard",
            "bg-destructive text-destructive-foreground hover:opacity-90": variant === "failed",
          },
          className
        )}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button }
