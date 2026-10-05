import * as React from "react";
import { cn } from "@/lib/utils";
import { PixelBlast } from "@/components/ui/pixel-blast";

type Band = "none" | "neutral" | "dense" | "stripe" | "accent" | "hero";

/**
 * Full-bleed section primitive.
 * Outer wrapper owns the full-bleed hairline (and optional dither/stripe band).
 * Inner constrains content padding inside the sheet column.
 */
export function SheetSection({
  children,
  className,
  innerClassName,
  band = "none",
  last = false,
  flush = false,
  as: Tag = "section",
}: {
  children: React.ReactNode;
  className?: string;
  innerClassName?: string;
  band?: Band;
  last?: boolean;
  /** Drop the gutter so children can run edge-to-edge (they own their own padding). */
  flush?: boolean;
  as?: "section" | "div" | "header" | "footer";
}) {
  const bandClass =
    band === "accent"
      ? "sheet-band"
      : band === "stripe"
        ? "sheet-band-stripe bg-stripe-divider"
        : band === "dense"
          ? "sheet-band bg-dither-50"
          : band === "neutral"
            ? "sheet-band bg-dither-25"
            : null;

  return (
    <Tag className={cn("sheet-section", last && "sheet-section-last", className)}>
      {band === "hero" ? (
        <div aria-hidden="true" className="sheet-band sheet-band-hero">
          <PixelBlast color="#f97316" pixelSize={4} fade="down" />
        </div>
      ) : null}
      <div className={cn("sheet-inner", flush && "sheet-inner-flush", innerClassName)}>{children}</div>
      {band !== "hero" && bandClass ? (
        <div aria-hidden="true" className={bandClass}>
          {band === "accent" && (
            <PixelBlast color="#f97316" pixelSize={4} fade="none" />
          )}
        </div>
      ) : null}
    </Tag>
  );
}
