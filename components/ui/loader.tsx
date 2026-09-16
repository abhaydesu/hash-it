import * as React from "react"
import { cn } from "@/lib/utils"

export interface LoaderProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: "sm" | "md" | "lg"
}

function Loader({ className, size = "md", ...props }: LoaderProps) {
  return (
    <div
      className={cn(
        "animate-pulse bg-muted",
        {
          "h-4 w-1/4": size === "sm",
          "h-8 w-1/2": size === "md",
          "h-32 w-full": size === "lg",
        },
        className
      )}
      {...props}
    />
  )
}

function Spinner({ className, ...props }: React.HTMLAttributes<SVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("animate-spin text-muted-foreground", className)}
      {...props}
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  )
}

export { Loader, Spinner }
