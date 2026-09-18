import * as React from "react";
import { cn } from "@/lib/utils";
import { PixelBlast } from "@/components/ui/pixel-blast";

type Band = "none" | "neutral" | "dense" | "accent" | "hero";

/**
 * Full-bleed section primitive.
 * Outer wrapper owns the full-bleed hairline (and optional dither band).
 * Inner constrains content padding inside the sheet column.
 */
export function SheetSection({
  children,
  className,
  innerClassName,
  band = "none",
  last = false,
  as: Tag = "section",
}: {
  children: React.ReactNode;
  className?: string;
  innerClassName?: string;
  band?: Band;
  last?: boolean;
  as?: "section" | "div" | "header" | "footer";
}) {
  const bandClass =
    band === "accent"
      ? "sheet-band"
      : band === "dense"
        ? "sheet-band bg-dither-50"
        : band === "hero"
          ? "sheet-band sheet-band-hero"
          : band === "neutral"
            ? "sheet-band bg-dither-25"
            : null;

  return (
    <Tag className={cn("sheet-section", last && "sheet-section-last", className)}>
      {bandClass ? (
        <div aria-hidden="true" className={bandClass}>
          {(band === "hero" || band === "accent") && (
            <PixelBlast color="#f97316" pixelSize={4} />
          )}
        </div>
      ) : null}
      <div className={cn("sheet-inner", innerClassName)}>{children}</div>
    </Tag>
  );
}
