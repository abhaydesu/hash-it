import * as React from "react";
import { cn } from "@/lib/utils";

/** One fact: label above, value below. No rounded corners. */
export function SpecCell({
  label,
  value,
  subvalue,
  className,
  children,
}: {
  label: React.ReactNode;
  value?: React.ReactNode;
  subvalue?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col justify-between bg-background p-3 sm:p-4", className)}>
      <div className="type-label">{label}</div>
      <div className="mt-1.5 text-xl sm:text-2xl font-semibold tracking-tight text-foreground tabular-numbers">
        {value ?? children}
      </div>
      {subvalue != null && subvalue !== false && (
        <div className="mt-1 text-xs text-muted-foreground">{subvalue}</div>
      )}
    </div>
  );
}

/** Grid of SpecCells — outer border owns the edge; gap-px draws hairlines between cells. */
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
    <div className={cn("grid gap-px border border-border bg-border", colClass, className)}>
      {children}
    </div>
  );
}

/** Technical-drawing caption. Accent on the fig mark. */
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
    <p className={cn("mt-2.5 type-caption", className)}>
      <span className="font-semibold text-orange-600 dark:text-orange-400">Fig. {fig}.</span>{" "}
      <span>{title}</span>
    </p>
  );
}
