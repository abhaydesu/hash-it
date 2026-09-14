"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, BarChart3, CalendarRange, CheckCircle2, Clock3, Database, Plus, RefreshCw, Target, TrendingUp } from "lucide-react";

export default function TodayDashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [weekly, setWeekly] = useState<any>(null);
  const [monthly, setMonthly] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        setIsLoading(true);
        const [statsRes, weeklyRes, monthlyRes] = await Promise.all([
          fetch("/api/stats"),
          fetch("/api/review/weekly"),
          fetch("/api/review/monthly"),
        ]);

        if (!statsRes.ok || !weeklyRes.ok || !monthlyRes.ok) {
          throw new Error("Unable to load dashboard data");
        }

        const [statsData, weeklyData, monthlyData] = await Promise.all([
          statsRes.json(),
          weeklyRes.json(),
          monthlyRes.json(),
        ]);

        setStats(statsData);
        setWeekly(weeklyData);
        setMonthly(monthlyData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load dashboard");
      } finally {
        setIsLoading(false);
      }
    };

    loadDashboard();
  }, []);

  const openLogProblem = () => {
    window.dispatchEvent(new CustomEvent("open-command-bar"));
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
        <RefreshCw className="h-6 w-6 animate-spin text-emerald-500" />
        <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Loading dashboard</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-6 text-center">
          <p className="text-sm text-rose-400">{error}</p>
        </div>
      </div>
    );
  }

  const statCards = [
    { label: "Total entries", value: stats?.totalEntries ?? 0, icon: Database },
    { label: "Cold-solve rate", value: `${Math.round((stats?.coldSolveRate ?? 0) * 100)}%`, icon: TrendingUp },
    { label: "Active leeches", value: stats?.leechCount ?? 0, icon: Target },
    { label: "Weekly focus", value: `${weekly?.summary?.belowTargetCount ?? 0} at risk`, icon: Clock3 },
  ];

  const weeklyStatus = weekly?.summary;
  const monthlyStatus = monthly?.problemCount ? `${monthly.problemCount} problems` : "Ready";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="font-pixel text-[11px] uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-300">Overview</div>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.06em] text-foreground">Today’s retention dashboard</h1>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={openLogProblem}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-foreground px-4 py-2.5 text-sm font-medium text-background active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" />
            Add problem
          </button>
          <Link href="/problems" className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground active:scale-[0.98]">
            Review catalog
          </Link>
        </div>
      </div>

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

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <div className="rounded-[24px] border border-border bg-card/80 p-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-pixel text-[11px] uppercase tracking-[0.18em] text-sky-600 dark:text-sky-300">Next weekly review</div>
                <h2 className="mt-2 text-2xl font-semibold tracking-[-0.05em] text-foreground">{weeklyStatus?.belowTargetCount ?? 0} patterns need attention</h2>
              </div>
              <CalendarRange className="h-5 w-5 text-sky-500" />
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-border bg-background/60 p-3">
                <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Below target</div>
                <div className="mt-2 font-pixel text-xl text-foreground">{weeklyStatus?.belowTargetCount ?? 0}</div>
              </div>
              <div className="rounded-xl border border-border bg-background/60 p-3">
                <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Untouched</div>
                <div className="mt-2 font-pixel text-xl text-foreground">{weeklyStatus?.untouchedCount ?? 0}</div>
              </div>
              <div className="rounded-xl border border-border bg-background/60 p-3">
                <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Healthy</div>
                <div className="mt-2 font-pixel text-xl text-foreground">{weeklyStatus?.healthyCount ?? 0}</div>
              </div>
            </div>

            <Link href="/review/weekly" className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-emerald-600 dark:text-emerald-300">
              Open weekly review <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="rounded-[24px] border border-border bg-card/80 p-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-pixel text-[11px] uppercase tracking-[0.18em] text-amber-600 dark:text-amber-300">Next monthly review</div>
                <h2 className="mt-2 text-2xl font-semibold tracking-[-0.05em] text-foreground">{monthlyStatus}</h2>
              </div>
              <BarChart3 className="h-5 w-5 text-amber-500" />
            </div>

            <div className="mt-4 rounded-xl border border-border bg-background/60 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                Previous mock batch is ready to review when you need it.
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Monthly review draws from your weakest pattern families so you can stress-test weak recall before a heavier interview cycle.
              </p>
            </div>

            <Link href="/review/monthly" className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-amber-600 dark:text-amber-300">
              Open monthly review <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-[24px] border border-border bg-card/80 p-5">
            <div className="font-pixel text-[11px] uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-300">Quick actions</div>
            <div className="mt-4 space-y-3">
              <button type="button" onClick={openLogProblem} className="flex w-full items-center justify-between rounded-xl border border-border bg-background/60 px-3 py-3 text-left text-sm text-foreground hover:bg-muted">
                <span>Log a new problem</span>
                <Plus className="h-4 w-4" />
              </button>
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

          <div className="rounded-[24px] border border-border bg-card/80 p-5">
            <div className="font-pixel text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Revision timeline</div>
            <div className="mt-4 space-y-3">
              <div className="rounded-xl border border-border bg-background/60 p-3">
                <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Previous weekly review</div>
                <div className="mt-2 text-sm font-medium text-foreground">{weeklyStatus?.healthyCount ?? 0} patterns were stable last cycle</div>
              </div>
              <div className="rounded-xl border border-border bg-background/60 p-3">
                <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Previous monthly review</div>
                <div className="mt-2 text-sm font-medium text-foreground">{monthlyStatus}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
