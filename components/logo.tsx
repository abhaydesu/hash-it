import * as React from "react";
import { cn } from "@/lib/utils";

export function Logo({ className, ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 275 281"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("h-6 w-6 text-foreground", className)}
      aria-label="Hash-It logo"
      {...props}
    >
      <path
        d="M172 172H275V275H189V234H163V172H86V281H0V145H86V86H172V172ZM275 149H189V0H275V149ZM86 86H0V0H86V86Z"
        fill="currentColor"
      />
    </svg>
  );
}
