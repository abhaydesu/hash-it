"use client";

import Link from "next/link";
import {
  BarChart3,
  CalendarRange,
  Clock3,
  Database,
  ExternalLink,
  Target,
  TrendingUp,
  ArrowRight,
  X,
} from "lucide-react";
import { useState, useEffect } from "react";
import { RecallCardItem } from "@/components/recall-card-item";
import { ReviewCardItem } from "@/components/review-card-item";

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
      <div className="space-y-6 animate-pulse">
        <div className="h-10 w-64 rounded bg-zinc-800" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-24 rounded-2xl bg-zinc-800/60" />)}
        </div>
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

  const statCards = [
    { label: "Problems logged", value: snapshot.totalEntries, icon: Database },
    { label: "Cold-solve rate", value: `${Math.round(snapshot.coldSolveRate * 100)}%`, icon: TrendingUp },
    { label: "Due today", value: queue.length, icon: Clock3 },
    { label: "Leeches", value: snapshot.leechCount, icon: Target },
  ];

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="font-pixel text-[11px] uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-300">Overview</div>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.06em] text-foreground">Today&apos;s retention dashboard</h1>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link href="/problems" className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground active:scale-[0.98]">
            Review catalog
          </Link>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {statCards.map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-2xl border border-border bg-card/80 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{label}</span>
              <Icon className="h-4 w-4 text-emerald-500" />
            </div>
            <div className="mt-4 font-pixel text-2xl text-foreground">{value}</div>
          </div>
        ))}
      </div>

      {/* Overdue banner */}
      {overdueCount > 20 && !overdueDissmissed && (
        <div className="flex items-center justify-between rounded-xl border border-amber-800/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-300">
          <span>
            <span className="font-semibold">{overdueCount} cards overdue.</span>{" "}
            Reviews are capped, so this clears slowly — consider a catch-up session or{" "}
            <Link href="/settings" className="underline underline-offset-2 hover:text-amber-200">lowering retention in settings.</Link>
          </span>
          <button
            onClick={() => setOverdueDismissed(true)}
            className="ml-4 shrink-0 rounded p-1 hover:bg-amber-900/40"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Today's review section */}
      <div className="rounded-[24px] border border-border bg-card/80 p-5">
        <div className="mb-4">
          <div className="font-pixel text-[11px] uppercase tracking-[0.18em] text-sky-600 dark:text-sky-300">Today&apos;s review</div>
          <p className="mt-2 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{recallCount} quick recall check{recallCount !== 1 ? "s" : ""}</span> and{" "}
            <span className="font-medium text-foreground">{resolveCount} full re-solve{resolveCount !== 1 ? "s" : ""}.</span>{" "}
            About <span className="font-medium text-foreground">{estimateMinutes} minutes.</span>
          </p>
        </div>

        {activeQueue.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-background/40 p-5 text-sm text-muted-foreground">
            {queue.length > 0
              ? "All done for today! Great work. Log new problems with ⌘K."
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
      </div>

      {/* Pattern drill & Blind mock */}
      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <div className="rounded-[24px] border border-border bg-card/80 p-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-pixel text-[11px] uppercase tracking-[0.18em] text-sky-600 dark:text-sky-300">Pattern drill</div>
                <h2 className="mt-2 text-2xl font-semibold tracking-[-0.05em] text-foreground">Read a cue, name the pattern.</h2>
              </div>
              <CalendarRange className="h-5 w-5 text-sky-500" />
            </div>
            <p className="mt-3 text-sm text-muted-foreground">Tests whether you recognise the technique, not whether you can implement it. ~2 min · active when a pattern is below target retrievability or untouched for 14 days.</p>
            <div className="mt-4 text-sm text-amber-500">Next drill in 3 days</div>
          </div>

          <div className="rounded-[24px] border border-border bg-card/80 p-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-pixel text-[11px] uppercase tracking-[0.18em] text-amber-600 dark:text-amber-300">Blind mock</div>
                <h2 className="mt-2 text-2xl font-semibold tracking-[-0.05em] text-foreground">Five timed problems from your weakest patterns.</h2>
              </div>
              <BarChart3 className="h-5 w-5 text-amber-500" />
            </div>
            <p className="mt-3 text-sm text-muted-foreground">Tests whether you can pick the right approach unprompted. ~2 hrs · active when 30+ days since the last mock.</p>
            <div className="mt-4 text-sm text-slate-500">Next mock in 12 days</div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-[24px] border border-border bg-card/80 p-5">
            <div className="font-pixel text-[11px] uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-300">Quick links</div>
            <div className="mt-4 space-y-3">
              <Link href="/problems" className="flex w-full items-center justify-between rounded-xl border border-border bg-background/60 px-3 py-3 text-left text-sm text-foreground hover:bg-muted">
                <span>Browse your problem library</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/stats" className="flex w-full items-center justify-between rounded-xl border border-border bg-background/60 px-3 py-3 text-left text-sm text-foreground hover:bg-muted">
                <span>Open analytics</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
