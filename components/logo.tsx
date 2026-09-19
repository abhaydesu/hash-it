import * as React from "react";
import { cn } from "@/lib/utils";

export function Logo({ className, ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 96 96"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("h-6 w-6", className)}
      aria-label="Hash-It logo"
      {...props}
    >
      <rect x="24" y="6" width="12" height="84" fill="currentColor" />
      <rect x="60" y="6" width="12" height="84" fill="currentColor" />
      <rect x="6" y="24" width="84" height="12" fill="currentColor" />
      <rect x="6" y="60" width="84" height="12" fill="currentColor" />
      <rect x="36" y="36" width="24" height="24" fill="#F97316" />
    </svg>
  );
}
