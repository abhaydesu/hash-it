"use client";

import Link from "next/link";
import {
  CalendarRange,
  Clock3,
  Database,
  Target,
  TrendingUp,
  X,
} from "lucide-react";
import { useState, useEffect } from "react";
import { RecallCardItem } from "@/components/recall-card-item";
import { ReviewCardItem } from "@/components/review-card-item";
import { SpecGrid, SpecCell } from "@/components/ui/spec-sheet";
import { SheetSection } from "@/components/ui/sheet-section";

// ─── Types ────────────────────────────────────────────────────────────────────

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

interface TodayData {
  queue: QueueItem[];
  resolveCount: number;
  recallCount: number;
  snapshot: Snapshot;
  overdueCount: number;
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function TodayDashboardPage() {
  const [data, setData] = useState<TodayData | null>(null);
  const [loading, setLoading] = useState(true);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [overdueDissmissed, setOverdueDismissed] = useState(false);

  const fetchData = async () => {
    try {
      const res = await fetch("/api/today-queue");
      if (!res.ok) throw new Error("Failed to fetch");
      const json: TodayData = await res.json();
      setData(json);
    } catch (err) {
      console.error("Failed to load today data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCardComplete = (entryId: string) => {
    setCompletedIds((prev) => new Set([...prev, entryId]));
  };

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="h-9 w-32 bg-dither-25" />
        <div className="grid grid-cols-2 lg:grid-cols-4 border border-border bg-border gap-px">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="p-4 space-y-2 bg-background">
              <div className="h-3 w-20 bg-dither-25" />
              <div className="h-6 w-14 bg-dither-25" />
            </div>
          ))}
        </div>
        <div className="h-64 border border-border bg-dither-25" />
      </div>
    );
  }

  const queue = data?.queue ?? [];
  const resolveCount = data?.resolveCount ?? 0;
  const recallCount = data?.recallCount ?? 0;
  const snapshot = data?.snapshot ?? { totalEntries: 0, coldSolveRate: 0, leechCount: 0 };
  const overdueCount = data?.overdueCount ?? 0;

  const activeQueue = queue.filter((item) => !completedIds.has(item.entryId));
  const estimateMinutes = recallCount * 3 + resolveCount * 25;

  return (
    <div className="pb-12">
      {/* Page Header */}
      <SheetSection innerClassName="flex flex-col gap-3 sm:flex-row sm:items-baseline sm:justify-between py-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">
            Today
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Daily spaced-repetition queue and performance overview.
          </p>
        </div>
        <div>
          <Link
            href="/problems"
            className="border border-border bg-background hover:bg-muted px-4 py-2 text-xs font-semibold  tracking-wide text-foreground transition-colors inline-flex items-center"
          >
            Review catalogue
          </Link>
        </div>
      </SheetSection>

      {/* Spec-sheet metrics cells (no rounded cards) */}
      <SheetSection innerClassName="py-6" band="none">
      <SpecGrid columns={4}>
        <SpecCell label="Problems logged" value={snapshot.totalEntries} />
        <SpecCell label="Solved without help" value={`${Math.round(snapshot.coldSolveRate * 100)}%`} />
        <SpecCell label="Due today" value={queue.length} />
        <SpecCell label="Stuck problems" value={snapshot.leechCount} />
      </SpecGrid>
      </SheetSection>

      {/* Overdue warning banner */}
      {overdueCount > 20 && !overdueDissmissed && (
        <div className="flex items-center justify-between border border-warning bg-warning/10 px-4 py-3 text-xs sm:text-sm text-warning font-mono">
          <span>
            <span className="font-semibold  tracking-wider">{overdueCount} cards overdue.</span>{" "}
            Reviews are capped, so this clears slowly — consider a catch-up session or{" "}
            <Link href="/settings" className="underline underline-offset-2 hover:opacity-80 font-sans">
              lowering retention in settings.
            </Link>
          </span>
          <button
            type="button"
            onClick={() => setOverdueDismissed(true)}
            className="ml-4 shrink-0 p-1 hover:bg-warning/20 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Today's review section */}
      <SheetSection innerClassName="py-6 space-y-4">
        <div className="border-b border-border pb-2 flex items-baseline justify-between">
          <h2 className="text-base font-semibold text-foreground tracking-tight">
            Today&apos;s review
          </h2>
            <span className="text-[11px] text-muted-foreground tabular-numbers">
            <span className="font-semibold text-foreground">{recallCount}</span> quick recall and{" "}
            <span className="font-semibold text-foreground">{resolveCount}</span> full re-solve ·{" "}
            ~{estimateMinutes} min
          </span>
        </div>

        {activeQueue.length === 0 ? (
            <div className="border border-border bg-dither-25 p-6 text-[11px] text-muted-foreground text-center">
            {queue.length > 0
              ? "All done for today. Log new problems with ⌘K or review the catalog."
              : "Nothing due today. Log new problems with ⌘K, or work through your roadmap."}
          </div>
        ) : (
          <div className="space-y-4">
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

      {/* Pattern drill & Blind mock assessment */}
      <SheetSection innerClassName="py-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="border border-border bg-background p-4 sm:p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-foreground tracking-tight">
                Pattern drill
              </h2>
              <CalendarRange className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
              Tests recognition of core algorithmic technique without implementation overhead. ~2 min per drill.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-[10px] font-mono  tracking-wider text-muted-foreground">
            <span>Interval: 14 days</span>
            <Link href="/review/weekly" className="text-foreground hover:underline font-semibold">
              Open drill →
            </Link>
          </div>
        </div>

        <div className="border border-border bg-background p-4 sm:p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-foreground tracking-tight">
                Blind mock
              </h2>
              <Clock3 className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
              Full unprompted assessment under interview conditions. Tests technique selection from problem statement alone.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-[10px] font-mono  tracking-wider text-muted-foreground">
            <span>Interval: 30 days</span>
            <Link href="/review/monthly" className="text-foreground hover:underline font-semibold">
              Start mock →
            </Link>
          </div>
        </div>
      </SheetSection>
    </div>
  );
}
