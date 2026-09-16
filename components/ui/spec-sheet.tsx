import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * SpecCell: A single spec-sheet cell divided by hairlines holding one fact.
 * Strictly no rounded corners. Technical metadata block.
 */
export function SpecCell({
  label,
  value,
  subvalue,
  className,
  children,
}: {
  label: string;
  value?: React.ReactNode;
  subvalue?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn("p-3 sm:p-4 bg-background border-border flex flex-col justify-between", className)}>
      <div className="text-[11px] font-medium tracking-[0.04em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-1.5 tabular-numbers text-xl sm:text-2xl font-semibold tracking-tight text-foreground">
        {value ?? children}
      </div>
      {subvalue && (
        <div className="mt-1 text-xs text-muted-foreground">
          {subvalue}
        </div>
      )}
    </div>
  );
}

/**
 * SpecGrid: A grid of spec-sheet cells divided by hairlines.
 */
export function SpecGrid({
  children,
  columns = 4,
  className,
}: {
  children: React.ReactNode;
  columns?: 2 | 3 | 4 | 5;
  className?: string;
}) {
  const colClass = {
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-3",
    4: "grid-cols-2 lg:grid-cols-4",
    5: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5",
  }[columns];

  return (
    <div className={cn("grid border border-border bg-border gap-px", colClass, className)}>
      {children}
    </div>
  );
}

/**
 * FigureCaption: Technical-drawing vernacular caption, e.g. "Fig. 1. Daily review queue."
 */
export function FigureCaption({
  fig,
  title,
  className,
}: {
  fig: string | number;
  title: string;
  className?: string;
}) {
  return (
    <div className={cn("mt-2.5 flex items-baseline gap-2 text-xs text-muted-foreground", className)}>
      <span className="font-semibold text-foreground tracking-tight">
        Fig. {fig}.
      </span>
      <span>{title}</span>
    </div>
  );
}
