import * as React from "react";
import { cn } from "@/lib/utils";

export interface LoaderProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: "sm" | "md" | "lg";
}

/** Content-shaped skeleton. Prefer this over spinners. */
function Loader({ className, size = "md", ...props }: LoaderProps) {
  return (
    <div
      className={cn(
        "skeleton bg-dither-25",
        {
          "h-3 w-24": size === "sm",
          "h-8 w-48": size === "md",
          "h-40 w-full": size === "lg",
        },
        className
      )}
      {...props}
    />
  );
}

function PageSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-6 py-6">
      <div className="space-y-2">
        <Loader className="h-8 w-40" />
        <Loader className="h-3 w-64" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px border border-border bg-border">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-background p-4 space-y-2">
            <Loader className="h-3 w-20" />
            <Loader className="h-7 w-14" />
          </div>
        ))}
      </div>
      <div className="skeleton border border-border bg-dither-25" style={{ height: `${rows * 4}rem` }} />
    </div>
  );
}

export { Loader, PageSkeleton };
