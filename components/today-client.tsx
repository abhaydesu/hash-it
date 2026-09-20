"use client";
import React from "react";

import Link from "next/link";
import { CalendarRange, Clock3, X } from "lucide-react";
import { useState } from "react";
import { RecallCardItem } from "@/components/recall-card-item";
import { ReviewCardItem } from "@/components/review-card-item";
import { SpecGrid, SpecCell } from "@/components/ui/spec-sheet";
import { SheetSection } from "@/components/ui/sheet-section";
import { useIsMac } from "@/lib/use-is-mac";

type ReviewLane = "RECALL" | "RESOLVE";

interface QueueItem {
  entryId: string;
  problemId: string;
  title: string;
  number?: number | null;
  url: string;
  difficulty?: "EASY" | "MEDIUM" | "HARD" | null;
  platform: string;
  lapses: number;
  reps: number;
  family?: string | null;
  lane: ReviewLane;
  lastRating?: string | null;
  revisit?: boolean;
  mistake?: string | null;
  idea?: string | null;
}

interface Snapshot {
  totalEntries: number;
  coldSolveRate: number;
  leechCount: number;
}

export interface TodayData {
  queue: QueueItem[];
  resolveCount: number;
  recallCount: number;
  snapshot: Snapshot;
  overdueCount: number;
}

export function TodayClient({ data }: { data: TodayData }) {
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [overdueDismissed, setOverdueDismissed] = useState(false);
  const isMac = useIsMac();
  const shortcutHint = isMac ? "⌘K" : "Ctrl+K";

  const handleCardComplete = (entryId: string) => {
    setCompletedIds((prev) => new Set([...prev, entryId]));
  };

  const { queue, resolveCount, recallCount, snapshot, overdueCount } = data;
  const activeQueue = queue.filter((item) => !completedIds.has(item.entryId));
  const estimateMinutes = recallCount * 3 + resolveCount * 25;

  return (
    <div>
      <SheetSection innerClassName="flex flex-col gap-3 py-6 sm:flex-row sm:items-baseline sm:justify-between">
        <div>
          <h1 className="type-title text-foreground">Today</h1>
          <p className="mt-1 type-caption">
            Problems due for review, sorted by priority.
          </p>
        </div>
        <Link
          href="/problems"
          className="pressable inline-flex h-8 items-center self-start border border-border bg-background px-3 text-xs font-medium text-foreground hover:bg-muted"
        >
          Review catalogue
        </Link>
      </SheetSection>

      <SheetSection innerClassName="py-6" band="neutral">
        <SpecGrid columns={4}>
          <SpecCell label="Problems logged" value={snapshot.totalEntries} />
          <SpecCell
            label="Solved without help"
            value={`${Math.round(snapshot.coldSolveRate * 100)}%`}
          />
          <SpecCell label="Due today" value={queue.length} />
          <SpecCell label="Stuck problems" value={snapshot.leechCount} />
        </SpecGrid>
      </SheetSection>

      {overdueCount > 20 && !overdueDismissed && (
        <SheetSection innerClassName="py-3">
          <div className="flex items-start justify-between gap-3 border border-warning/40 bg-background px-4 py-3 text-sm text-warning">
            <p>
              <span className="font-semibold tabular-numbers">{overdueCount} cards overdue.</span> Reviews
              are capped, so this clears slowly. Consider a catch-up session or{" "}
              <Link href="/settings" className="text-orange-600 underline underline-offset-2 hover:text-orange-700">
                lowering retention in settings
              </Link>
              .
            </p>
            <button
              type="button"
              onClick={() => setOverdueDismissed(true)}
              className="shrink-0 p-1 hover:bg-muted"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </SheetSection>
      )}

      <SheetSection innerClassName="space-y-4 py-6">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
          <h2 className="type-heading text-foreground">Review queue</h2>
          <p className="type-caption tabular-numbers">
            <span className="font-semibold text-foreground">{recallCount}</span> quick recall and{" "}
            <span className="font-semibold text-foreground">{resolveCount}</span> full re-solve, about{" "}
            {estimateMinutes} min.
          </p>
        </div>

        {activeQueue.length === 0 ? (
          <div className="idea-preview border border-border bg-dither-25 px-4 py-10 text-center">
            <p className="text-sm font-medium text-foreground">
              {queue.length > 0 ? "All done for today." : "Nothing due today."}
            </p>
            <p className="mt-1 type-caption">
              {queue.length > 0
                ? `Log new problems with ${shortcutHint} or review the catalogue.`
                : `Log new problems with ${shortcutHint}, or work through your roadmap.`}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {activeQueue.map((item) =>
              item.lane === "RECALL" ? (
                <RecallCardItem
                  key={item.entryId}
                  item={item}
                  onComplete={() => handleCardComplete(item.entryId)}
                />
              ) : (
                <ReviewCardItem
                  key={item.entryId}
                  item={item}
                  onComplete={() => handleCardComplete(item.entryId)}
                />
              )
            )}
          </div>
        )}
      </SheetSection>

      <SheetSection innerClassName="py-6" band="none" last>
        <div className="grid grid-cols-1 divide-y divide-border border border-border md:grid-cols-2 md:divide-x md:divide-y-0">
          <div className="flex flex-col justify-between bg-background p-4 sm:p-5">
            <div>
              <div className="flex items-center justify-between">
                <h2 className="type-heading text-foreground">Weekly drill</h2>
                <CalendarRange className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="mt-2 type-caption leading-relaxed">
                Read a cue, name the pattern. About two minutes per drill.
              </p>
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-border pt-3 type-caption">
              <span>Interval: 14 days</span>
              <Link href="/review/weekly" className="font-medium text-orange-600 hover:text-orange-700">
                Open drill
              </Link>
            </div>
          </div>

          <div className="flex flex-col justify-between bg-background p-4 sm:p-5">
            <div>
              <div className="flex items-center justify-between">
                <h2 className="type-heading text-foreground">Monthly mock</h2>
                <Clock3 className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="mt-2 type-caption leading-relaxed">
                Five blind problems, timed. No labels, no hints.
              </p>
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-border pt-3 type-caption">
              <span>Interval: 30 days</span>
              <Link href="/review/monthly" className="font-medium text-orange-600 hover:text-orange-700">
                Start mock
              </Link>
            </div>
          </div>
        </div>
      </SheetSection>
    </div>
  );
}
