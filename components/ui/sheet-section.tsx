import * as React from "react";
import { cn } from "@/lib/utils";

export function SheetSection({
  children,
  className,
  innerClassName,
  band = "neutral",
}: {
  children: React.ReactNode;
  className?: string;
  innerClassName?: string;
  band?: "none" | "neutral" | "accent";
}) {
  return (
    <section className={cn("sheet-section", className)}>
      <div className={cn("relative z-10", innerClassName)}>{children}</div>
      {band !== "none" && <div aria-hidden="true" className={cn("sheet-band", band === "accent" ? "bg-dither-orange" : "bg-dither-25")} />}
    </section>
  );
}
