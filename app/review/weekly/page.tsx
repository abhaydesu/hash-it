"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RefreshCw, Target, Eye, EyeOff, AlertTriangle, Clock, CheckCircle2, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface PatternItem {
  id: string;
  name: string;
  family: string;
  sortOrder: number;
  cue: string;
  avgRetrievability: number;
  hasCards: boolean;
  cardCount: number;
  daysSinceReview: number | null;
  isBelowTarget: boolean;
  isUntouched14Days: boolean;
  sampleProblems: Array<{
    id: string;
    title: string;
    number: number | null;
    url: string;
    difficulty: string | null;
  }>;
}

interface WeeklyData {
  targetRetention: number;
  summary: {
    belowTargetCount: number;
    untouchedCount: number;
    healthyCount: number;
    unpracticedCount: number;
  };
  belowTarget: PatternItem[];
  untouched14Days: PatternItem[];
  healthy: PatternItem[];
  all: PatternItem[];
}

export default function WeeklyReviewPage() {
  const [data, setData] = useState<WeeklyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revealedPatterns, setRevealedPatterns] = useState<Record<string, boolean>>({});

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/review/weekly");
      if (!res.ok) throw new Error("Failed to load weekly review data");
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const toggleReveal = (id: string) => {
    setRevealedPatterns((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const revealAll = () => {
    if (!data) return;
    const all: Record<string, boolean> = {};
    data.belowTarget.forEach((p) => {
      all[p.id] = true;
    });
    setRevealedPatterns(all);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-3 font-mono">
        <RefreshCw className="h-5 w-5 text-emerald-500 animate-spin" />
        <span className="text-xs text-zinc-500">LOADING_WEEKLY_DRILL...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-3">
        <div className="text-rose-400 font-mono text-sm">{error || "Failed to load drill"}</div>
        <button
          onClick={fetchData}
          className="rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-800"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="border-b border-zinc-800 pb-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-emerald-400" />
              <h1 className="text-lg font-mono font-bold text-zinc-100 uppercase tracking-tight">
                WEEKLY_TRIGGER_CUE_DRILL
              </h1>
            </div>
            <p className="text-xs text-zinc-400 mt-1">
              Five cue prompts drawn from your weakest patterns to check whether you can name the technique before seeing the heading.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 rounded border border-zinc-800 bg-zinc-900/60 px-3 py-1 font-mono text-xs text-zinc-400">
              <span>Target Retrievability:</span>
              <span className="font-semibold text-emerald-400">{(data.targetRetention * 100).toFixed(0)}%</span>
            </div>
            {data.belowTarget.length > 0 && (
              <button
                onClick={revealAll}
                className="rounded border border-zinc-700 bg-zinc-800/80 px-3 py-1 text-xs font-mono text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100 transition-colors"
              >
                Reveal All
              </button>
            )}
          </div>
        </div>

        {/* Stats summary bar */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-xs">
          <div className="rounded border border-rose-900/40 bg-rose-950/20 px-3 py-2">
            <span className="text-rose-400 font-semibold">{data.summary.belowTargetCount}</span>
            <span className="text-zinc-400 ml-1.5">below target</span>
          </div>
          <div className="rounded border border-amber-900/40 bg-amber-950/20 px-3 py-2">
            <span className="text-amber-400 font-semibold">{data.summary.untouchedCount}</span>
            <span className="text-zinc-400 ml-1.5">untouched ≥ 14d</span>
          </div>
          <div className="rounded border border-emerald-900/40 bg-emerald-950/20 px-3 py-2">
            <span className="text-emerald-400 font-semibold">{data.summary.healthyCount}</span>
            <span className="text-zinc-400 ml-1.5">healthy</span>
          </div>
          <div className="rounded border border-zinc-800 bg-zinc-900/40 px-3 py-2">
            <span className="text-zinc-400 font-semibold">{data.summary.unpracticedCount}</span>
            <span className="text-zinc-500 ml-1.5">unpracticed</span>
          </div>
        </div>
      </div>

      {/* Section 1: Weak Patterns (< Target Retrievability) Cue Flashcards */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-mono font-semibold uppercase tracking-wider text-rose-400 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" /> Patterns Below Target (Priority Drill)
          </h2>
          <span className="text-xs text-zinc-500 font-mono">
            {data.belowTarget.length} requiring reinforcement
          </span>
        </div>

        {data.belowTarget.length === 0 ? (
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-6 text-center">
            <CheckCircle2 className="mx-auto h-6 w-6 text-emerald-400 mb-2" />
            <p className="text-sm font-medium text-zinc-300">All reviewed patterns are above target retention!</p>
            <p className="text-xs text-zinc-500 mt-1">Check untouched patterns or log new problems to expand your repertoire.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.belowTarget.map((pattern) => {
              const isRevealed = revealedPatterns[pattern.id];
              const retrievabilityPct = (pattern.avgRetrievability * 100).toFixed(0);

              return (
                <div
                  key={pattern.id}
                  className="rounded-lg border border-zinc-800 bg-zinc-950 flex flex-col justify-between overflow-hidden hover:border-zinc-700 transition-all"
                >
                  <div className="p-4 space-y-3">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-zinc-500 uppercase">{pattern.family}</span>
                      <span className="text-rose-400 font-semibold">{retrievabilityPct}% R</span>
                    </div>

                    {/* Trigger Cue */}
                    <div className="rounded bg-zinc-900/70 border border-zinc-800/80 p-3 min-h-[90px] flex items-center">
                      <p className="text-xs font-sans text-zinc-200 leading-relaxed italic">
                        "{pattern.cue}"
                      </p>
                    </div>

                    {/* Answer reveal */}
                    <div className="pt-1">
                      {isRevealed ? (
                        <div className="rounded border border-emerald-800/60 bg-emerald-950/40 p-2.5 space-y-1 animate-in fade-in">
                          <div className="text-[10px] font-mono text-emerald-400 uppercase tracking-wide">Pattern</div>
                          <div className="text-sm font-bold font-mono text-zinc-100">{pattern.name}</div>
                          <div className="text-[11px] text-zinc-400">
                            {pattern.cardCount} logged {pattern.cardCount === 1 ? "problem" : "problems"}
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => toggleReveal(pattern.id)}
                          className="w-full flex items-center justify-center gap-2 rounded border border-zinc-800 bg-zinc-900/80 py-2.5 text-xs font-mono text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 transition-colors"
                        >
                          <Eye className="h-3.5 w-3.5" /> Reveal Pattern
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Sample problem links */}
                  {isRevealed && pattern.sampleProblems.length > 0 && (
                    <div className="border-t border-zinc-900 bg-zinc-900/30 px-4 py-2 text-xs">
                      <span className="text-[10px] font-mono text-zinc-500 uppercase">Review practice:</span>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {pattern.sampleProblems.map((sp) => (
                          <a
                            key={sp.id}
                            href={sp.url}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded bg-zinc-800/80 hover:bg-zinc-700 px-2 py-0.5 text-[11px] font-mono text-zinc-300 transition-colors"
                          >
                            {sp.number ? `#${sp.number}` : sp.title}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Section 2: Untouched in 14+ Days */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-mono font-semibold uppercase tracking-wider text-amber-400 flex items-center gap-2">
            <Clock className="h-4 w-4" /> Untouched in ≥ 14 Days
          </h2>
          <span className="text-xs text-zinc-500 font-mono">
            {data.untouched14Days.length} patterns at risk of decay
          </span>
        </div>

        {data.untouched14Days.length === 0 ? (
          <div className="rounded-lg border border-zinc-800/60 bg-zinc-900/20 p-4 text-xs font-mono text-zinc-400">
            No patterns have been idle for more than 14 days. Good consistency!
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.untouched14Days.map((pattern) => (
              <div
                key={pattern.id}
                className="rounded-lg border border-amber-950/60 bg-zinc-950/80 p-3.5 space-y-2"
              >
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="font-semibold text-zinc-200">{pattern.name}</span>
                  <span className="text-amber-400 font-medium">
                    {pattern.daysSinceReview != null ? `${pattern.daysSinceReview}d ago` : "Never reviewed"}
                  </span>
                </div>
                <p className="text-xs text-zinc-400 line-clamp-2">"{pattern.cue}"</p>
                <div className="flex items-center justify-between text-[11px] font-mono text-zinc-500 pt-1 border-t border-zinc-900">
                  <span>Family: {pattern.family}</span>
                  <Link
                    href={`/patterns?selected=${pattern.id}`}
                    className="text-emerald-400 hover:text-emerald-300 flex items-center gap-0.5"
                  >
                    View problems <ChevronRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
