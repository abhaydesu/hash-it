"use client";

import React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type WizardPhase = "brief" | "compose" | "load" | "map" | "review" | "assign" | "confirm";

const STEPS: Array<{ id: WizardPhase; label: string }> = [
  { id: "brief", label: "Overview" },
  { id: "compose", label: "Get the CSV" },
  { id: "load", label: "Upload" },
  { id: "map", label: "Columns" },
  { id: "review", label: "Review" },
  { id: "assign", label: "Status" },
  { id: "confirm", label: "Commit" },
];

const ORDER: Record<WizardPhase, number> = STEPS.reduce(
  (acc, s, i) => ({ ...acc, [s.id]: i }),
  {} as Record<WizardPhase, number>
);

export function WizardStepper({
  current,
  onJump,
  furthestReached,
}: {
  current: WizardPhase;
  onJump?: (phase: WizardPhase) => void;
  furthestReached: WizardPhase;
}) {
  const currentIdx = ORDER[current];
  const maxIdx = ORDER[furthestReached];

  return (
    <ol className="grid grid-cols-7 gap-0 border border-border bg-background">
      {STEPS.map((step, idx) => {
        const isCurrent = idx === currentIdx;
        const isCompleted = idx < currentIdx;
        const isReachable = idx <= maxIdx;

        return (
          <li key={step.id} className={cn(idx > 0 && "border-l border-border")}>
            <button
              type="button"
              disabled={!isReachable || !onJump}
              onClick={() => isReachable && onJump?.(step.id)}
              className={cn(
                "group flex w-full flex-col items-center gap-1 px-2 py-2.5 text-left transition-colors sm:items-start sm:px-3",
                isCurrent && "bg-orange-500/10",
                !isCurrent && isReachable && "hover:bg-muted/40",
                !isReachable && "cursor-not-allowed opacity-50"
              )}
              aria-current={isCurrent ? "step" : undefined}
            >
              <div className="flex items-center gap-1.5">
                <span
                  className={cn(
                    "flex h-4 w-4 items-center justify-center border text-[10px] tabular-nums",
                    isCurrent && "border-orange-500 bg-orange-500 text-white",
                    isCompleted && "border-easy bg-easy/10 text-easy",
                    !isCurrent && !isCompleted && "border-border bg-muted text-muted-foreground"
                  )}
                >
                  {isCompleted ? <Check className="icon-pop h-2.5 w-2.5" /> : idx + 1}
                </span>
                <span
                  className={cn(
                    "type-label hidden sm:inline",
                    isCurrent ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {step.label}
                </span>
              </div>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

export const wizardOrder = ORDER;
