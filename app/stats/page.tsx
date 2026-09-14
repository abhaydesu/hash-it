"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RefreshCw, BarChart2, AlertTriangle, Clock, Target, Layers, Hash, ExternalLink } from "lucide-react";
import { formatDifficulty } from "@/lib/utils";

interface StatsData {
  coldSolveRate: number;
  totalAttempts: number;
  totalEntries: number;
  medianMinutes: {
    EASY: number;
    MEDIUM: number;
    HARD: number;
  };
  lapseRate: number;
  leechCount: number;
  leechEntries: Array<{
    entryId: string;
    problemId: string;
    title: string;
    number: number | null;
    url: string;
    difficulty: "EASY" | "MEDIUM" | "HARD" | null;
    platform: string;
    lapses: number;
    mistake: string | null;
  }>;
  countByDifficulty: Record<string, number>;
  countBySourceList: Record<string, number>;
  topMistakeKeywords: Array<{ word: string; count: number }>;
}

export default function StatsPage() {
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stats");
      if (!res.ok) throw new Error("Failed to load statistics");
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-3 font-mono">
        <RefreshCw className="h-6 w-6 text-emerald-500 animate-spin" />
        <span className="text-xs text-zinc-500 tracking-wider">CALCULATING_AGGREGATE_STATISTICS...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-3">
        <div className="text-rose-400 font-mono text-sm">{error || "Failed to load stats"}</div>
        <button
          onClick={fetchStats}
          className="rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-mono text-zinc-200 hover:bg-zinc-800"
        >
          Retry
        </button>
      </div>
    );
  }

  const coldSolvePct = (data.coldSolveRate * 100).toFixed(1);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="border-b border-zinc-800 pb-3 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 font-mono">
            <BarChart2 className="h-4 w-4 text-emerald-400" />
            <h1 className="text-lg font-bold text-zinc-100 uppercase tracking-tight">
              PERFORMANCE_METRICS
            </h1>
          </div>
          <p className="text-xs text-zinc-400 mt-1 font-sans">
            Personal instrumentation summary. Cold-solve rate is the primary signal of algorithm retention.
          </p>
        </div>
      </div>

      {/* Top Headline Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Cold-Solve Rate */}
        <div className="rounded-lg border border-emerald-900/60 bg-emerald-950/20 p-5 space-y-2 font-mono">
          <div className="text-xs text-emerald-400 uppercase font-semibold flex items-center justify-between">
            <span>Cold-Solve Rate</span>
            <Target className="h-4 w-4" />
          </div>
          <div className="text-3xl font-bold text-zinc-100">{coldSolvePct}%</div>
          <p className="text-[11px] text-zinc-400 font-sans">
            {data.totalAttempts} total review attempts logged
          </p>
        </div>

        {/* Total Solved Entries */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-5 space-y-2 font-mono">
          <div className="text-xs text-zinc-400 uppercase font-semibold flex items-center justify-between">
            <span>Total Logged Problems</span>
            <Layers className="h-4 w-4 text-zinc-500" />
          </div>
          <div className="text-3xl font-bold text-zinc-100">{data.totalEntries}</div>
          <p className="text-[11px] text-zinc-400 font-sans">Across canonical problem catalog</p>
        </div>

        {/* Lapse Rate */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-5 space-y-2 font-mono">
          <div className="text-xs text-zinc-400 uppercase font-semibold flex items-center justify-between">
            <span>Lapse Rate</span>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </div>
          <div className="text-3xl font-bold text-amber-400">
            {data.lapseRate.toFixed(2)} <span className="text-xs text-zinc-500 font-normal">lapses/card</span>
          </div>
          <p className="text-[11px] text-zinc-400 font-sans">{data.leechCount} active leeches (≥3 lapses)</p>
        </div>

        {/* Median Solve Times */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-5 space-y-2 font-mono">
          <div className="text-xs text-zinc-400 uppercase font-semibold flex items-center justify-between">
            <span>Median Solve Time</span>
            <Clock className="h-4 w-4 text-zinc-500" />
          </div>
          <div className="flex items-baseline gap-2 text-xs">
            <span className="text-emerald-400 font-bold">{data.medianMinutes.EASY}m</span>
            <span className="text-zinc-600">/</span>
            <span className="text-amber-400 font-bold">{data.medianMinutes.MEDIUM}m</span>
            <span className="text-zinc-600">/</span>
            <span className="text-rose-400 font-bold">{data.medianMinutes.HARD}m</span>
          </div>
          <p className="text-[11px] text-zinc-400 font-sans">Easy / Medium / Hard baselines</p>
        </div>
      </div>

      {/* Middle Grid: Breakdowns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 font-mono text-xs">
        {/* Difficulty Distribution */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-5 space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
            Problems Solved by Difficulty
          </h2>

          <div className="space-y-3">
            {Object.entries(data.countByDifficulty).map(([diff, count]) => {
              const diffInfo = formatDifficulty(diff as any);
              const percentage = data.totalEntries > 0 ? (count / data.totalEntries) * 100 : 0;

              return (
                <div key={diff} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className={diffInfo.className + " px-1.5 py-0.2 rounded border text-[10px]"}>
                      {diff}
                    </span>
                    <span className="text-zinc-300">
                      {count} ({percentage.toFixed(0)}%)
                    </span>
                  </div>
                  <div className="w-full bg-zinc-900 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-emerald-500 h-full transition-all"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Source List Distribution */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-5 space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
            Problems by Source List
          </h2>

          <div className="space-y-3">
            {Object.entries(data.countBySourceList).map(([source, count]) => {
              const percentage = data.totalEntries > 0 ? (count / data.totalEntries) * 100 : 0;

              return (
                <div key={source} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-300 font-semibold">{source}</span>
                    <span className="text-zinc-400">
                      {count} ({percentage.toFixed(0)}%)
                    </span>
                  </div>
                  <div className="w-full bg-zinc-900 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-sky-500 h-full transition-all"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Frequency Analysis of Mistakes */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-5 space-y-4 font-mono text-xs">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
            <Hash className="h-4 w-4 text-emerald-400" /> Top Mistake Corpus Frequency
          </h2>
          <span className="text-[11px] text-zinc-500 font-sans">Derived from your mistake notes</span>
        </div>

        {data.topMistakeKeywords.length === 0 ? (
          <div className="text-zinc-500 italic py-4">No mistake notes recorded yet.</div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {data.topMistakeKeywords.map(({ word, count }) => (
              <div
                key={word}
                className="flex items-center gap-1.5 rounded border border-zinc-800 bg-zinc-900/80 px-2.5 py-1 text-zinc-300 hover:border-zinc-700"
              >
                <span>{word}</span>
                <span className="rounded bg-zinc-800 px-1.5 py-0.2 text-[10px] text-emerald-400 font-bold">
                  {count}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Leech List Section */}
      <div className="rounded-lg border border-rose-950/80 bg-rose-950/10 p-5 space-y-4 font-mono text-xs">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-rose-400 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-rose-500" /> Active Leeches (≥ 3 Lapses)
          </h2>
          <span className="text-rose-400 font-bold">{data.leechCount} problems</span>
        </div>

        {data.leechEntries.length === 0 ? (
          <div className="text-zinc-500 text-xs py-2">No active leeches. Great job on retention!</div>
        ) : (
          <div className="space-y-3">
            {data.leechEntries.map((leech) => {
              const diff = formatDifficulty(leech.difficulty);

              return (
                <div
                  key={leech.entryId}
                  className="rounded border border-rose-900/60 bg-zinc-950 p-4 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-rose-400 font-bold">Lapses: {leech.lapses}</span>
                      <span className={`rounded border px-1.5 py-0.2 text-[10px] ${diff.className}`}>
                        {diff.label}
                      </span>
                      <a
                        href={leech.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-zinc-100 hover:text-emerald-400 font-semibold transition-colors flex items-center gap-1"
                      >
                        {leech.title} <ExternalLink className="h-3 w-3 opacity-60" />
                      </a>
                    </div>
                    <Link
                      href={`/problems/${leech.entryId}`}
                      className="rounded border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-[11px] text-zinc-300 hover:bg-zinc-800"
                    >
                      View Detail
                    </Link>
                  </div>

                  {leech.mistake && (
                    <div className="rounded bg-rose-950/30 border border-rose-900/40 p-2.5 text-rose-200/90 text-[11px] font-sans">
                      <span className="font-mono text-rose-400 font-semibold uppercase text-[9px] block mb-1">
                        Mistake Note:
                      </span>
                      {leech.mistake}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
