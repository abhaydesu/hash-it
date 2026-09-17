import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "outcome-good" | "outcome-hard" | "outcome-again" | "outcome-failed";
  size?: "sm" | "md" | "lg";
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-1.5 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-40",
          {
            "h-8 px-3 text-xs": size === "sm",
            "h-9 px-4 text-sm": size === "md",
            "h-10 px-5 text-sm": size === "lg",
          },
          {
            "bg-orange-500 text-white hover:bg-orange-600 dark:bg-orange-500 dark:text-background dark:hover:bg-orange-400":
              variant === "primary",
            "border border-border bg-background text-foreground hover:bg-muted": variant === "secondary",
            "text-foreground hover:bg-muted": variant === "ghost",
            "outcome-fill-good": variant === "outcome-good",
            "outcome-fill-hint": variant === "outcome-hard",
            "border border-hard/50 bg-background text-hard hover:bg-hard/10": variant === "outcome-again",
            "outcome-fill-failed": variant === "outcome-failed",
          },
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button };
